import { PDFParse } from "pdf-parse";
import { RawFundRecord } from "../types";

const CALSTRS_BASE = "https://www.calstrs.com";
const PERFORMANCE_PAGE = `${CALSTRS_BASE}/private-equity-portfolio-performance-table`;

export async function fetchCalSTRS(): Promise<RawFundRecord[]> {
  console.log("Fetching CalSTRS data...");

  const pdfUrl = await discoverPdfUrl();
  console.log(`  Using: ${pdfUrl}`);

  const parser = new PDFParse({ url: pdfUrl });
  const result = await parser.getText();
  await parser.destroy();

  if (!result.text || result.text.length < 100) {
    throw new Error("CalSTRS: PDF text extraction returned insufficient content");
  }

  const funds = parseCalSTRSText(result.text);
  const asOfDate = deriveAsOfDate(pdfUrl, result.text);
  funds.forEach((f) => (f.as_of_date = asOfDate));

  console.log(`CalSTRS: parsed ${funds.length} funds${asOfDate ? ` (as of ${asOfDate})` : ""}`);
  return funds;
}

async function discoverPdfUrl(): Promise<string> {
  try {
    const res = await fetch(PERFORMANCE_PAGE, {
      headers: { "User-Agent": "FundMark-Research/1.0", Accept: "text/html" },
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();
      const patterns = [
        /href=["']([^"']*PrivateEquityPerformanceReport[^"']*\.pdf)["']/i,
        /href=["']([^"']*Private[\s_-]*Equity[\s_-]*Performance[^"']*\.pdf)["']/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          return match[1].startsWith("http")
            ? match[1]
            : `${CALSTRS_BASE}${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
        }
      }
    }
  } catch {}

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const candidates = [
    `${CALSTRS_BASE}/files/CalSTRSPrivateEquityPerformanceReportFYE${currentFY}.pdf`,
    `${CALSTRS_BASE}/files/CalSTRSPrivateEquityPerformanceReportFYE${currentFY - 1}.pdf`,
    // Hash-based URLs found in the wild
    `${CALSTRS_BASE}/files/5c3703f7c/CalSTRSPrivateEquityPerformanceReportFYE2024.pdf`,
  ];

  for (const url of candidates) {
    try {
      const head = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (head.ok) return url;
    } catch {
      continue;
    }
  }

  return candidates[0];
}

function deriveAsOfDate(url: string, text: string): string | null {
  const fyeMatch = url.match(/FYE(\d{4})/i);
  if (fyeMatch) return `${fyeMatch[1]}-06-30`;

  const textMatch =
    text.match(/as\s+of\s+([\w]+\s+\d{1,2},?\s+\d{4})/i) ||
    text.match(/(June|March|September|December)\s+\d{1,2},?\s+\d{4}/i);
  if (textMatch) {
    const parsed = new Date(textMatch[1]);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }

  return null;
}

function parseCalSTRSText(text: string): RawFundRecord[] {
  const funds: RawFundRecord[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10 || isSkipLine(trimmed)) continue;

    const fund = parseLine(trimmed);
    if (fund) funds.push(fund);
  }

  return funds;
}

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^(description|fund\s*name|vintage|total|sub\s*total|grand\s*total)/i.test(line) ||
    /^(private\s*equity|portfolio\s*summary|page\s+\d|as\s+of)/i.test(line) ||
    /^(calstrs|california\s+state\s+teachers)/i.test(line) ||
    /^-{3,}$/.test(line) ||
    (lower.includes("committed") && lower.includes("irr")) ||
    (lower.includes("vintage") && lower.includes("distributed"))
  );
}

function parseLine(line: string): RawFundRecord | null {
  const tokens = line.split(/\s+/);
  const numPattern = /^[\($]?-?[\d,.]+[%)\s]*$|^-{1,3}$|^N\/?A$/i;

  let numStart = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (numPattern.test(tokens[i])) numStart = i;
    else break;
  }

  if (numStart >= tokens.length || numStart < 1) return null;

  const fundName = tokens.slice(0, numStart).join(" ").trim();
  if (!fundName || fundName.length < 3) return null;

  const nums = tokens.slice(numStart);
  if (nums.length < 2) return null;

  const vintageYear = parseNum(nums[0]);
  if (vintageYear === null || vintageYear < 1980 || vintageYear > 2030) return null;

  let committed: number | null = null;
  let contributed: number | null = null;
  let distributed: number | null = null;
  let marketValue: number | null = null;
  let irr: number | null = null;

  if (nums.length >= 6) {
    committed = parseNum(nums[1]);
    contributed = parseNum(nums[2]);
    distributed = parseNum(nums[3]);
    marketValue = parseNum(nums[4]);
    irr = parsePct(nums[5]);
  } else if (nums.length === 5) {
    committed = parseNum(nums[1]);
    contributed = parseNum(nums[2]);
    distributed = parseNum(nums[3]);
    irr = parsePct(nums[4]);
  } else if (nums.length === 4) {
    contributed = parseNum(nums[1]);
    distributed = parseNum(nums[2]);
    irr = parsePct(nums[3]);
  } else {
    irr = parsePct(nums[nums.length - 1]);
  }

  if (committed !== null) committed *= 1_000_000;
  if (contributed !== null) contributed *= 1_000_000;
  if (distributed !== null) distributed *= 1_000_000;
  if (marketValue !== null) marketValue *= 1_000_000;

  let tvpi: number | null = null;
  if (contributed && contributed > 0 && distributed !== null && marketValue !== null) {
    tvpi = Math.round(((distributed + marketValue) / contributed) * 100) / 100;
  }

  let dpi: number | null = null;
  if (contributed && contributed > 0 && distributed !== null) {
    dpi = Math.round((distributed / contributed) * 100) / 100;
  }

  return {
    fund_name: fundName,
    vintage_year: vintageYear,
    capital_committed: committed,
    cash_in: contributed,
    cash_out: distributed,
    remaining_value: marketValue,
    net_irr: irr,
    tvpi,
    dpi,
    source: "calstrs",
    as_of_date: null,
  };
}

function parseNum(str: string | undefined): number | null {
  if (!str || str === "-" || str === "--" || str === "---") return null;
  if (/^N\/?A$/i.test(str)) return null;
  let cleaned = str.replace(/[$,\s]/g, "");
  const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (isNegative) cleaned = cleaned.slice(1, -1);
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

function parsePct(str: string | undefined): number | null {
  if (!str || str.startsWith("n.m") || str === "-" || /^N\/?A$/i.test(str)) return null;
  const isNegative = str.includes("(") && str.includes(")");
  const cleaned = str.replace(/[%,\s()]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}