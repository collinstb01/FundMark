import { PDFParse } from "pdf-parse";
import { RawFundRecord } from "../types";

const SBA_BASE = "https://www.sbafla.com";
const REPORT_PAGE = `${SBA_BASE}/reporting/alternative-asset-status-performance-report/`;

export async function fetchFlorida(): Promise<RawFundRecord[]> {
  console.log("Fetching Florida SBA data...");

  const pdfUrl = await discoverPdfUrl();
  if (!pdfUrl) throw new Error("Florida SBA: could not find PE performance PDF");

  console.log(`  Using: ${pdfUrl}`);

  const parser = new PDFParse({ url: pdfUrl });
  const result = await parser.getText();
  await parser.destroy();

  if (!result.text || result.text.length < 100) {
    throw new Error("Florida SBA: PDF text extraction returned insufficient content");
  }

  const funds = parseFloridaText(result.text);
  const asOfDate = deriveAsOfDate(pdfUrl, result.text);
  funds.forEach((f) => (f.as_of_date = asOfDate));

  console.log(`Florida SBA: parsed ${funds.length} funds${asOfDate ? ` (as of ${asOfDate})` : ""}`);
  return funds;
}

async function discoverPdfUrl(): Promise<string | null> {
  const knownUrls = [
    `${SBA_BASE}/media/tahe3s5w/q2-2025-private-equity-revised.pdf`,
    `${SBA_BASE}/media/3bmntb1b/q1-2025-private-equity-performance.pdf`,
    `${SBA_BASE}/media/ic0hylqq/q4-2024-prive-equity-performance-report.pdf`,
    `${SBA_BASE}/media/yehhveym/q3-2024-private-equity-performance-report.pdf`,
  ];

  for (const url of knownUrls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "FundMark-Research/1.0", Range: "bytes=0-0" },
        redirect: "follow",
      });
      if (res.ok || res.status === 206) {
        console.log(`  Found: ${url}`);
        return url;
      }
    } catch {
      continue;
    }
  }

  try {
    const res = await fetch(REPORT_PAGE, {
      headers: { "User-Agent": "FundMark-Research/1.0", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();

    const patterns = [
      /href=["']([^"']*private[- _]?equity[^"']*\.pdf)["']/gi,
      /href=["']([^"']*\/media\/[^"']*private[^"']*equity[^"']*\.pdf)["']/gi,
      /\(([^)]*private[- _]?equity[^)]*\.pdf)\)/gi,
      /\(([^)]*\/media\/[^)]*\.pdf)\)/gi,
    ];

    const seen = new Set<string>();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const raw = match[1];
        if (seen.has(raw)) continue;
        seen.add(raw);

        const url = raw.startsWith("http")
          ? raw
          : `${SBA_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;

        if (!url.toLowerCase().includes("strategic") && !url.toLowerCase().includes("si-performance")) {
          try {
            const head = await fetch(url, { method: "HEAD", redirect: "follow" });
            if (head.ok) return url;
          } catch {
            continue;
          }
        }
      }
    }
  } catch {}

  return null;
}

function deriveAsOfDate(url: string, text: string): string | null {
  const urlMatch = url.match(/[qQ](\d)[- _]?(\d{4})/);
  if (urlMatch) {
    const quarter = parseInt(urlMatch[1], 10);
    const year = parseInt(urlMatch[2], 10);
    const endMonth = quarter * 3;
    const lastDay = new Date(year, endMonth, 0).getDate();
    return `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
  }

  const textMatch =
    text.match(/as\s+of\s+([\w]+\s+\d{1,2},?\s+\d{4})/i) ||
    text.match(/(June|March|September|December)\s+\d{1,2},?\s+\d{4}/i);
  if (textMatch) {
    const parsed = new Date(textMatch[1] || textMatch[0]);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }

  return null;
}

/**
 * Florida SBA PDF format:
 *
 * Fund Name  Year  Commitment  Paid-In  Distributions  NAV  TVPI  IRR%
 *
 * Vintage year is a plain 4-digit year (not a date like WSIB).
 * TVPI is a decimal (e.g., 1.78), no "x" suffix.
 * IRR has "%" suffix or "NA".
 * Values are in actual dollars (not millions).
 */
function parseFloridaText(text: string): RawFundRecord[] {
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
    lower.includes("reporting currency") ||
    lower.includes("cash flow") ||
    lower.includes("valuation multiple") ||
    lower.includes("alternative asset") ||
    lower.includes("fund current") ||
    lower.includes("inception commit") ||
    lower.includes("paid-in") ||
    lower.includes("paid in") ||
    lower.startsWith("total ") ||
    lower.startsWith("sub-total") ||
    lower.startsWith("note:") ||
    lower.startsWith("1fund") ||
    lower.includes("because of the long-term") ||
    lower.includes("interim returns") ||
    lower.includes("standardized valuation") ||
    lower.includes("general partners") ||
    lower.includes("state board of administration") ||
    lower.includes("florida state board") ||
    /^page\s+\d/i.test(line) ||
    /^-{3,}$/.test(line)
  );
}

function parseLine(line: string): RawFundRecord | null {
  // Find a 4-digit vintage year (1988-2030) that sits between the fund name and numeric columns.
  // The year is NOT part of a date (no slashes) and NOT part of a dollar amount.
  const yearPattern = /\b(19[89]\d|20[0-2]\d|2030)\b/g;
  let yearMatch: RegExpExecArray | null;
  let bestMatch: { year: number; index: number } | null = null;

  while ((yearMatch = yearPattern.exec(line)) !== null) {
    const year = parseInt(yearMatch[1], 10);
    const before = line.charAt(yearMatch.index - 1);
    const after = line.charAt(yearMatch.index + yearMatch[0].length);

    // Skip if it's part of a larger number (e.g., 200,000,000)
    if (before === "," || after === ",") continue;
    // Skip if it's in the fund name but followed by another word (e.g., "Fund 2017 LP")
    // We want the year that's followed by numeric data
    if (/[a-zA-Z]/.test(after)) continue;

    bestMatch = { year, index: yearMatch.index };
  }

  if (!bestMatch) return null;

  const fundName = line.substring(0, bestMatch.index).trim();
  if (!fundName || fundName.length < 3) return null;

  const vintageYear = bestMatch.year;
  const afterYear = line.substring(bestMatch.index + String(vintageYear).length).trim();
  const tokens = afterYear.split(/\s+/).filter(Boolean);

  // Expected: Commitment, Paid-In, Distributions, NAV, TVPI, IRR
  if (tokens.length < 4) return null;

  const committed = parseNum(tokens[0]);
  const paidIn = parseNum(tokens[1]);
  const distributed = parseNum(tokens[2]);
  const nav = parseNum(tokens[3]);

  let tvpi: number | null = null;
  let irr: number | null = null;

  // TVPI and IRR are the last two tokens
  if (tokens.length >= 6) {
    tvpi = parseNum(tokens[4]);
    irr = parsePctOrNA(tokens[5]);
  } else if (tokens.length === 5) {
    tvpi = parseNum(tokens[3]);
    irr = parsePctOrNA(tokens[4]);
    // Reassign — nav was actually tvpi
  }

  let dpi: number | null = null;
  if (paidIn && paidIn > 0 && distributed !== null) {
    dpi = Math.round((distributed / paidIn) * 100) / 100;
  }

  return {
    fund_name: fundName,
    vintage_year: vintageYear,
    capital_committed: committed,
    cash_in: paidIn,
    cash_out: distributed,
    remaining_value: nav,
    net_irr: irr,
    tvpi,
    dpi,
    source: "florida",
    as_of_date: null,
  };
}

function parseNum(str: string | undefined): number | null {
  if (!str || str === "-" || str.toUpperCase() === "NA") return null;
  let cleaned = str.replace(/[$,\s]/g, "");
  const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (isNegative) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/%/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

function parsePctOrNA(str: string | undefined): number | null {
  if (!str || str.toUpperCase() === "NA") return null;
  const isNegative = str.includes("-") || (str.includes("(") && str.includes(")"));
  const cleaned = str.replace(/[%,\s()]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num;
}