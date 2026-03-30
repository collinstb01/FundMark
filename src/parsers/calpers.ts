import * as cheerio from "cheerio";
import { RawFundRecord } from "../types";

const CALPERS_URL =
  "https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance-print";

export async function fetchCalPERS(): Promise<RawFundRecord[]> {
  console.log("Fetching CalPERS data...");

  const response = await fetch(CALPERS_URL);
  if (!response.ok) throw new Error(`CalPERS fetch failed: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const funds: RawFundRecord[] = [];

  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 7) return;

    const texts = cells.toArray().map((c) => $(c).text().trim());

    let vintageIdx = -1;
    for (let j = 0; j < Math.min(texts.length, 3); j++) {
      const yr = parseInt(texts[j], 10);
      if (yr >= 1980 && yr <= 2030) {
        vintageIdx = j;
        break;
      }
    }
    if (vintageIdx === -1) return;

    const fundName = texts.slice(0, vintageIdx).join(" ").trim();
    if (!fundName || fundName.length < 3) return;

    const vintageYear = parseInt(texts[vintageIdx], 10);
    const after = texts.slice(vintageIdx + 1);
    if (after.length < 5) return;

    const capitalCommitted = parseNumber(after[0]);
    const cashIn = parseNumber(after[1]);
    const cashOut = parseNumber(after[2]);
    const cashOutAndRemaining = parseNumber(after[3]);
    const netIRR = parsePercent(after[4]);
    const investmentMultiple = after[5] ? parseMultiple(after[5]) : null;

    let dpi: number | null = null;
    if (cashIn && cashIn > 0 && cashOut !== null) {
      dpi = Math.round((cashOut / cashIn) * 100) / 100;
    }

    funds.push({
      fund_name: fundName,
      vintage_year: vintageYear,
      capital_committed: capitalCommitted,
      cash_in: cashIn,
      cash_out: cashOut,
      remaining_value:
        cashOutAndRemaining !== null && cashOut !== null
          ? cashOutAndRemaining - cashOut
          : null,
      net_irr: netIRR,
      tvpi: investmentMultiple,
      dpi,
      source: "calpers",
      as_of_date: null,
    });
  });

  const pageText = $("body").text();
  const dateMatch =
    pageText.match(/as of\s+([\w]+\s+\d{1,2},?\s+\d{4})/i) ||
    pageText.match(/(June|March|September|December)\s+\d{1,2},?\s+\d{4}/i);

  let asOfDate: string | null = null;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      asOfDate = parsed.toISOString().split("T")[0];
    }
  }

  funds.forEach((f) => {
    f.as_of_date = asOfDate;
  });

  console.log(`CalPERS: parsed ${funds.length} funds${asOfDate ? ` (as of ${asOfDate})` : ""}`);
  return funds;
}

function parseNumber(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, "").replace(/[()]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "N/A") return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return str.includes("(") ? -num : num;
}

function parsePercent(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[%,\s]/g, "").trim();
  if (["", "-", "N/A", "NM", "nm"].includes(cleaned)) return null;
  const isNegative = str.includes("(") && str.includes(")");
  const num = parseFloat(cleaned.replace(/[()]/g, ""));
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

function parseMultiple(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[x,\s]/g, "").trim();
  if (["", "-", "N/A", "nm"].includes(cleaned.toLowerCase())) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}