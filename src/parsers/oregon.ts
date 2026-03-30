import { PDFParse } from "pdf-parse";
import { RawFundRecord } from "../types";

const OREGON_BASE =
  "https://www.oregon.gov/treasury/invested-for-oregon/Documents/Invested-for-OR-Performance-and-Holdings";

export async function fetchOregon(): Promise<RawFundRecord[]> {
  console.log("Fetching Oregon PERS data...");

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);

  const urls: string[] = [];
  for (let y = year; y >= year - 1; y--) {
    const maxQ = y === year ? quarter : 4;
    for (let q = maxQ; q >= 1; q--) {
      urls.push(`${OREGON_BASE}/${y}/OPERF_Private_Equity_Portfolio_-_Quarter_${q}_${y}.pdf`);
    }
  }

  let text = "";
  let usedUrl = "";

  for (const url of urls) {
    try {
      const parser = new PDFParse({ url });
      const result = await parser.getText();
      if (result.text && result.text.length > 100) {
        text = result.text;
        usedUrl = url;
        await parser.destroy();
        console.log(`  Found: ${url}`);
        break;
      }
      await parser.destroy();
    } catch {
      continue;
    }
  }

  if (!text) throw new Error("Oregon PERS: could not find or parse any quarterly PDF");

  const funds = parseOregonText(text);

  const quarterMatch = usedUrl.match(/Quarter_(\d)_(\d{4})/);
  let asOfDate: string | null = null;
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1]);
    const y = parseInt(quarterMatch[2]);
    const quarterEndMonth = q * 3;
    const lastDay = new Date(y, quarterEndMonth, 0).getDate();
    asOfDate = `${y}-${String(quarterEndMonth).padStart(2, "0")}-${lastDay}`;
  }

  funds.forEach((f) => {
    f.as_of_date = asOfDate;
  });

  console.log(`Oregon PERS: parsed ${funds.length} funds${asOfDate ? ` (as of ${asOfDate})` : ""}`);
  return funds;
}

function parseOregonText(text: string): RawFundRecord[] {
  const funds: RawFundRecord[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(
      /^\*?\s*((?:19|20)\d{2})\s+(.+?)\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)\s+[\$(]*(-?[\d,.]+)\)?\s+([\d.]+x|n\.m\.?)\s*([\d.%-]+|n\.m\.?)?/
    );
    if (!match) continue;

    const vintageYear = parseInt(match[1], 10);
    const fundName = match[2].trim();
    const committed = parseNum(match[3]);
    const contributed = parseNum(match[4]);
    const distributed = parseNum(match[5]);
    const fairMarketValue = parseNum(match[6]);
    const tvpi = parseMult(match[7]);
    const irr = parsePct(match[8]);

    if (vintageYear < 1980 || vintageYear > 2030 || fundName.length < 3) continue;

    funds.push({
      fund_name: fundName,
      vintage_year: vintageYear,
      capital_committed: committed !== null ? committed * 1_000_000 : null,
      cash_in: contributed !== null ? contributed * 1_000_000 : null,
      cash_out: distributed !== null ? distributed * 1_000_000 : null,
      remaining_value: fairMarketValue !== null ? fairMarketValue * 1_000_000 : null,
      net_irr: irr,
      tvpi,
      dpi:
        contributed && contributed > 0 && distributed !== null
          ? Math.round((distributed / contributed) * 100) / 100
          : null,
      source: "oregon",
      as_of_date: null,
    });
  }

  return funds;
}

function parseNum(str: string | undefined): number | null {
  if (!str || str === "n.m." || str === "n.m" || str === "-") return null;
  const num = parseFloat(str.replace(/[$,\s()]/g, ""));
  return isNaN(num) ? null : num;
}

function parseMult(str: string | undefined): number | null {
  if (!str || str.startsWith("n.m")) return null;
  const num = parseFloat(str.replace(/[x\s]/g, ""));
  return isNaN(num) ? null : num;
}

function parsePct(str: string | undefined): number | null {
  if (!str || str.startsWith("n.m")) return null;
  const num = parseFloat(str.replace(/[%\s]/g, ""));
  return isNaN(num) ? null : num;
}