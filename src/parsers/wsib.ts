import { PDFParse } from "pdf-parse";
import { RawFundRecord } from "../types";

const WSIB_BASE = "https://www.sib.wa.gov";

const SECTION_STRATEGY_MAP: Record<string, string> = {
  "corporate finance/buyout": "buyout",
  "corporate finance": "buyout",
  buyout: "buyout",
  "venture capital": "venture",
  venture: "venture",
  "growth equity": "growth",
  growth: "growth",
  "distressed debt": "private_debt",
  distressed: "private_debt",
  mezzanine: "private_debt",
  "special situations": "buyout",
  secondaries: "secondaries",
  "secondary": "secondaries",
  "fund of funds": "fund_of_funds",
  "co-investment": "buyout",
};

export async function fetchWSIB(): Promise<RawFundRecord[]> {
  console.log("Fetching WSIB data...");

  const pdfUrl = await discoverPdfUrl();
  if (!pdfUrl) throw new Error("WSIB: could not discover PE performance PDF");

  console.log(`  Using: ${pdfUrl}`);

  const parser = new PDFParse({ url: pdfUrl });
  const result = await parser.getText();
  await parser.destroy();

  if (!result.text || result.text.length < 100) {
    throw new Error("WSIB: PDF text extraction returned insufficient content");
  }

  const funds = parseWSIBText(result.text);
  const asOfDate = deriveAsOfDate(pdfUrl, result.text);
  funds.forEach((f) => (f.as_of_date = asOfDate));

  console.log(`WSIB: parsed ${funds.length} funds${asOfDate ? ` (as of ${asOfDate})` : ""}`);
  return funds;
}

function buildIRRReportUrls(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const urls: string[] = [];

  for (let y = year; y >= year - 1; y--) {
    const maxQ = y === year ? quarter : 4;
    for (let q = maxQ; q >= 1; q--) {
      const monthEnd = q * 3;
      const lastDay = new Date(y, monthEnd, 0).getDate();
      const mm = String(monthEnd).padStart(2, "0");
      const dd = String(lastDay).padStart(2, "0");
      const yy = String(y).slice(2);
      urls.push(`${WSIB_BASE}/docs/reports/quarterly/ir${mm}${dd}${yy}.pdf`);
    }
  }

  return urls;
}

async function discoverPdfUrl(): Promise<string | null> {
  const candidates = buildIRRReportUrls();

  for (const url of candidates) {
    try {
      const head = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (head.ok) {
        console.log(`  Found: ${url}`);
        return url;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function deriveAsOfDate(url: string, text: string): string | null {
  // URL pattern: ir093025.pdf → 09/30/25
  const urlMatch = url.match(/ir(\d{2})(\d{2})(\d{2})\.pdf/);
  if (urlMatch) {
    const mm = urlMatch[1];
    const dd = urlMatch[2];
    const yy = urlMatch[3];
    return `20${yy}-${mm}-${dd}`;
  }

  const textMatch = text.match(/(?:as\s+of\s+|SEPTEMBER|JUNE|MARCH|DECEMBER)\s*(\d{1,2},?\s+\d{4})/i) ||
    text.match(/(SEPTEMBER|JUNE|MARCH|DECEMBER)\s+\d{1,2},?\s+\d{4}/i);
  if (textMatch) {
    const parsed = new Date(textMatch[0].replace(/as\s+of\s+/i, ""));
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }

  return null;
}

/**
 * WSIB PDF actual format (from the extracted text):
 *
 * Section headers like "Corporate Finance/Buyout - Large"
 * Then column headers, then data lines:
 *
 * Fund Name  MM/DD/YYYY  Committed  Paid-In  Unfunded  MarketValue  Distributed  TotalValue  TVPIx  Gain  IRR%
 *
 * The date (Initial Investment Date) is between the fund name and the numbers.
 * We detect lines by finding the date pattern, then split name vs numbers around it.
 */
function parseWSIBText(text: string): RawFundRecord[] {
  const funds: RawFundRecord[] = [];
  let currentStrategy: string | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const strategy = detectStrategy(trimmed);
    if (strategy !== undefined) {
      currentStrategy = strategy;
      continue;
    }

    if (isSkipLine(trimmed)) continue;

    const fund = parseLine(trimmed, currentStrategy);
    if (fund) funds.push(fund);
  }

  return funds;
}

function detectStrategy(line: string): string | null | undefined {
  // WSIB section headers look like "Corporate Finance/Buyout - Large" or "Venture Capital"
  // They contain strategy keywords but no date patterns or large numbers
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) return undefined; // Has a date = data line
  if (line.length > 80 || line.length < 4) return undefined;

  const lower = line.toLowerCase().replace(/[/-]/g, " ").trim();

  for (const [key, value] of Object.entries(SECTION_STRATEGY_MAP)) {
    if (lower.includes(key)) return value;
  }

  return undefined; // Not a section header
}

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes("investment name") ||
    lower.includes("capital committed") ||
    lower.includes("paid-in") ||
    lower.includes("performance summary") ||
    lower.includes("washington state investment board") ||
    lower.includes("overview by strategy") ||
    lower.includes("hamilton lane") ||
    lower.includes("j-curve") ||
    lower.includes("irr calculation") ||
    lower.includes("irrs contained") ||
    lower.includes("irrs presented") ||
    lower.includes("irrs tend") ||
    lower.includes("general partners tend") ||
    lower.includes("comparisons of interim") ||
    lower.includes("note:") ||
    lower.includes("the information above") ||
    lower.includes("commitment\" column") ||
    lower.includes("amount contributed") ||
    lower.includes("total distributions") ||
    lower.startsWith("contributions") ||
    lower.startsWith("total ") ||
    lower.startsWith("sub-total") ||
    /^page\s+\d/i.test(line) ||
    /^-{3,}$/.test(line)
  );
}

/**
 * Parse a WSIB data line. The key insight: find the date (MM/DD/YYYY) which
 * separates the fund name from the numeric columns.
 */
function parseLine(line: string, strategy: string | null): RawFundRecord | null {
  // Find the date pattern — this anchors the split between name and data
  const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (!dateMatch) return null;

  const dateIdx = line.indexOf(dateMatch[0]);
  const fundName = line.substring(0, dateIdx).trim();
  if (!fundName || fundName.length < 3) return null;

  // Extract vintage year from the date
  const dateParts = dateMatch[1].split("/");
  const vintageYear = parseInt(dateParts[2], 10);
  if (vintageYear < 1980 || vintageYear > 2030) return null;

  // Everything after the date is numeric columns
  const afterDate = line.substring(dateIdx + dateMatch[0].length).trim();
  const tokens = afterDate.split(/\s+/).filter(Boolean);

  // Expected columns after date:
  // Committed | Paid-In | Unfunded | MarketValue | Distributed | TotalValue | TVPIx | Gain | IRR%
  // That's 9 columns, but some may be missing or combined
  if (tokens.length < 5) return null;

  // Find IRR — it's the last token and has % or ends with %
  // Find TVPI — it has an 'x' suffix
  let irr: number | null = null;
  let tvpi: number | null = null;

  const lastToken = tokens[tokens.length - 1];
  if (lastToken.includes("%") || lastToken.includes("(")) {
    irr = parsePct(lastToken);
  }

  // TVPI is the token with 'x' suffix
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].endsWith("x") && !tokens[i].includes("%")) {
      tvpi = parseMult(tokens[i]);
      break;
    }
  }

  // First 3 numeric tokens after date are: Committed, Paid-In, Unfunded
  const committed = parseNum(tokens[0]);
  const paidIn = parseNum(tokens[1]);
  // tokens[2] = unfunded (skip)
  const marketValue = parseNum(tokens[3]);
  const distributed = parseNum(tokens[4]);
  // tokens[5] = total value (skip, it's MV + Dist)
  // tokens[6] = TVPI (already parsed)
  // tokens[7] = gain (skip)
  // tokens[8] = IRR (already parsed)

  let dpi: number | null = null;
  if (paidIn && paidIn > 0 && distributed !== null) {
    dpi = Math.round((distributed / paidIn) * 100) / 100;
  }

  const sourceTag = strategy ? `wsib:${strategy}` : "wsib";

  return {
    fund_name: fundName,
    vintage_year: vintageYear,
    capital_committed: committed,
    cash_in: paidIn,
    cash_out: distributed,
    remaining_value: marketValue,
    net_irr: irr,
    tvpi,
    dpi,
    source: sourceTag,
    as_of_date: null,
  };
}

function parseNum(str: string | undefined): number | null {
  if (!str || str === "-") return null;
  let cleaned = str.replace(/[$,\s]/g, "");
  const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (isNegative) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/[%x]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

function parseMult(str: string | undefined): number | null {
  if (!str) return null;
  const num = parseFloat(str.replace(/[x\s]/g, ""));
  return isNaN(num) ? null : num;
}

function parsePct(str: string | undefined): number | null {
  if (!str) return null;
  const isNegative = str.includes("(") && str.includes(")");
  const cleaned = str.replace(/[%,\s()]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}