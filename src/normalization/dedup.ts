import { RawFundRecord, NormalizedFund, Strategy } from "../types";
import { classifyStrategy } from "./strategy";

export function deduplicateFunds(allRecords: RawFundRecord[]): NormalizedFund[] {
  console.log(`Deduplicating ${allRecords.length} raw records...`);

  const byVintage = new Map<number, RawFundRecord[]>();
  for (const record of allRecords) {
    const existing = byVintage.get(record.vintage_year) || [];
    existing.push(record);
    byVintage.set(record.vintage_year, existing);
  }

  const groups: Array<{ canonical_name: string; manager: string; vintage_year: number; records: RawFundRecord[] }> = [];

  for (const [vintage, records] of byVintage) {
    const normalized = records.map((r) => ({ record: r, normalized: normalizeName(r.fund_name) }));
    const matched = new Set<number>();

    for (let i = 0; i < normalized.length; i++) {
      if (matched.has(i)) continue;
      const group: RawFundRecord[] = [normalized[i].record];
      matched.add(i);

      for (let j = i + 1; j < normalized.length; j++) {
        if (matched.has(j)) continue;
        if (areSameFund(normalized[i].normalized, normalized[j].normalized)) {
          group.push(normalized[j].record);
          matched.add(j);
        }
      }

      groups.push({
        canonical_name: normalized[i].record.fund_name,
        manager: extractManager(normalized[i].record.fund_name),
        vintage_year: vintage,
        records: group,
      });
    }
  }

  const funds = groups.map((g) => mergeGroup(g));
  const dupeCount = allRecords.length - funds.length;
  console.log(`Deduplication: ${allRecords.length} records → ${funds.length} unique funds (${dupeCount} duplicates merged)`);
  return funds;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/,?\s*l\.?p\.?\s*$/i, "")
    .replace(/,?\s*llc\s*$/i, "")
    .replace(/,?\s*s\.?l\.?p\.?\s*$/i, "")
    .replace(/,?\s*scsp\s*$/i, "")
    .replace(/\s*-\s*/g, " ")
    .replace(/[,.'&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractManager(fundName: string): string {
  const cleaned = fundName
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/,?\s*L\.?P\.?\s*$/i, "")
    .replace(/,?\s*LLC\s*$/i, "")
    .replace(/,?\s*SCSp\s*$/i, "")
    .trim();
  const match = cleaned.match(/^(.+?)\s+(?:Fund\s+)?(?:Partners\s+)?(?:[IVXLC]+|[0-9]+)(?:\s|$|-)/i);
  if (match) return match[1].trim();
  const words = cleaned.split(/\s+/);
  return words.slice(0, Math.min(3, words.length)).join(" ");
}

function areSameFund(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (a.length > 10 && b.length > 10 && stringSimilarity(a, b) > 0.85) return true;
  return false;
}

function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) { costs[j] = j; }
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer[i - 1] !== shorter[j - 1]) newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

function mergeGroup(group: { canonical_name: string; manager: string; vintage_year: number; records: RawFundRecord[] }): NormalizedFund {
  const { strategy } = classifyStrategy(group.canonical_name);
  const sorted = [...group.records].sort((a, b) => {
    if (!a.as_of_date && !b.as_of_date) return 0;
    if (!a.as_of_date) return 1;
    if (!b.as_of_date) return -1;
    return b.as_of_date.localeCompare(a.as_of_date);
  });

  return {
    fund_id: group.canonical_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) + "_" + group.vintage_year,
    fund_name: group.canonical_name,
    manager: group.manager,
    vintage_year: group.vintage_year,
    strategy,
    geography: "US",
    capital_committed: first(sorted, "capital_committed"),
    cash_in: first(sorted, "cash_in"),
    cash_out: first(sorted, "cash_out"),
    remaining_value: first(sorted, "remaining_value"),
    net_irr: first(sorted, "net_irr"),
    tvpi: first(sorted, "tvpi"),
    dpi: first(sorted, "dpi"),
    source: group.records.map((r) => r.source).filter((v, i, a) => a.indexOf(v) === i).join(","),
    as_of_date: sorted[0]?.as_of_date || null,
  };
}

function first<T extends RawFundRecord, K extends keyof T>(records: T[], key: K): T[K] {
  for (const r of records) { if (r[key] !== null && r[key] !== undefined) return r[key]; }
  return null as T[K];
}