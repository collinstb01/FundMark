import { RawFundRecord } from "../types";

const IRR_MIN = -100;
const IRR_MAX = 500;
const IRR_WARN_MIN = -50;
const IRR_WARN_MAX = 200;
const TVPI_MIN = 0;
const TVPI_MAX = 20;
const TVPI_WARN_MAX = 10;
const DPI_MIN = 0;
const DPI_MAX = 20;
const DPI_WARN_MAX = 10;
const VINTAGE_YEAR_MIN = 1980;
const VINTAGE_YEAR_MAX = new Date().getFullYear() + 1;
const STALE_DATA_THRESHOLD_DAYS = 180;
const CROSS_SOURCE_IRR_TOLERANCE = 5;

const MIN_FUNDS_PER_SOURCE: Record<string, number> = {
  calpers: 300,
  oregon: 300,
  calstrs: 200,
  wsib: 200,
  florida: 100,
};

const EXPECTED_FUND_COUNTS: Record<string, { expected: number; tolerance: number }> = {
  calpers: { expected: 446, tolerance: 0.15 },
  oregon: { expected: 447, tolerance: 0.15 },
  calstrs: { expected: 460, tolerance: 0.25 },
  wsib: { expected: 460, tolerance: 0.25 },
  florida: { expected: 300, tolerance: 0.35 },
};

export interface ValidationError {
  type: "irr_out_of_range" | "metric_out_of_range" | "missing_required_field" | "column_mismatch" | "duplicate_inconsistency" | "checksum_mismatch";
  fund?: string;
  source?: string;
  message: string;
}

export interface ValidationWarning {
  type: "unusual_irr" | "unusual_metric" | "missing_optional_field" | "low_fund_count" | "stale_data";
  fund?: string;
  source?: string;
  message: string;
}

export interface ValidationStats {
  totalParsed: number;
  totalValid: number;
  totalErrors: number;
  totalWarnings: number;
  bySource: Record<string, { parsed: number; valid: number; errors: number }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface SourceBatch {
  source: string;
  funds: RawFundRecord[];
  parseErrorCount: number;
}

function validateFund(fund: RawFundRecord): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!fund.fund_name || fund.fund_name.trim().length < 3) {
    errors.push({ type: "missing_required_field", fund: fund.fund_name || "(unknown)", source: fund.source, message: "Fund name is missing or too short" });
  }

  if (fund.vintage_year < VINTAGE_YEAR_MIN || fund.vintage_year > VINTAGE_YEAR_MAX) {
    errors.push({ type: "column_mismatch", fund: fund.fund_name, source: fund.source, message: `Vintage year ${fund.vintage_year} outside [${VINTAGE_YEAR_MIN}, ${VINTAGE_YEAR_MAX}]` });
  }

  if (fund.net_irr !== null) {
    if (fund.net_irr < IRR_MIN || fund.net_irr > IRR_MAX) {
      errors.push({ type: "irr_out_of_range", fund: fund.fund_name, source: fund.source, message: `IRR ${fund.net_irr.toFixed(1)}% outside [${IRR_MIN}%, ${IRR_MAX}%]` });
    } else if (fund.net_irr < IRR_WARN_MIN || fund.net_irr > IRR_WARN_MAX) {
      warnings.push({ type: "unusual_irr", fund: fund.fund_name, source: fund.source, message: `IRR ${fund.net_irr.toFixed(1)}% is unusual` });
    }
  } else {
    warnings.push({ type: "missing_optional_field", fund: fund.fund_name, source: fund.source, message: "IRR is missing" });
  }

  if (fund.tvpi !== null) {
    if (fund.tvpi < TVPI_MIN || fund.tvpi > TVPI_MAX) {
      errors.push({ type: "metric_out_of_range", fund: fund.fund_name, source: fund.source, message: `TVPI ${fund.tvpi.toFixed(2)}x outside [${TVPI_MIN}, ${TVPI_MAX}x]` });
    } else if (fund.tvpi > TVPI_WARN_MAX) {
      warnings.push({ type: "unusual_metric", fund: fund.fund_name, source: fund.source, message: `TVPI ${fund.tvpi.toFixed(2)}x is unusually high` });
    }
  }

  if (fund.dpi !== null) {
    if (fund.dpi < DPI_MIN || fund.dpi > DPI_MAX) {
      errors.push({ type: "metric_out_of_range", fund: fund.fund_name, source: fund.source, message: `DPI ${fund.dpi.toFixed(2)}x outside [${DPI_MIN}, ${DPI_MAX}x]` });
    } else if (fund.dpi > DPI_WARN_MAX) {
      warnings.push({ type: "unusual_metric", fund: fund.fund_name, source: fund.source, message: `DPI ${fund.dpi.toFixed(2)}x is unusually high` });
    }
  }

  if (fund.dpi !== null && fund.tvpi !== null && fund.dpi > fund.tvpi + 0.01) {
    errors.push({ type: "metric_out_of_range", fund: fund.fund_name, source: fund.source, message: `DPI (${fund.dpi.toFixed(2)}x) exceeds TVPI (${fund.tvpi.toFixed(2)}x)` });
  }

  if (fund.as_of_date) {
    const daysDiff = Math.floor((Date.now() - new Date(fund.as_of_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > STALE_DATA_THRESHOLD_DAYS) {
      warnings.push({ type: "stale_data", fund: fund.fund_name, source: fund.source, message: `Data is ${daysDiff} days old (as-of ${fund.as_of_date})` });
    }
  }

  return { errors, warnings };
}

function checkParserHealth(batches: SourceBatch[]): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const batch of batches) {
    const baseSource = batch.source.split(":")[0];
    const minExpected = MIN_FUNDS_PER_SOURCE[baseSource] || 10;

    if (batch.funds.length === 0) {
      errors.push({ type: "column_mismatch", source: batch.source, message: `Parser returned 0 funds (expected ≥${minExpected})` });
    } else if (batch.funds.length < minExpected * 0.5) {
      errors.push({ type: "column_mismatch", source: batch.source, message: `Parser returned ${batch.funds.length} funds (expected ≥${minExpected})` });
    } else if (batch.funds.length < minExpected * 0.8) {
      warnings.push({ type: "low_fund_count", source: batch.source, message: `Parser returned ${batch.funds.length} funds, below expected ${minExpected}` });
    }

    const totalAttempted = batch.funds.length + batch.parseErrorCount;
    if (batch.parseErrorCount > 0 && totalAttempted > 0 && batch.parseErrorCount / totalAttempted > 0.2) {
      warnings.push({ type: "low_fund_count", source: batch.source, message: `${batch.parseErrorCount} parse errors (${Math.round((batch.parseErrorCount / totalAttempted) * 100)}% error rate)` });
    }

    if (batch.funds.length > 10) {
      const irrRate = batch.funds.filter((f) => f.net_irr !== null).length / batch.funds.length;
      if (irrRate < 0.5) {
        warnings.push({ type: "low_fund_count", source: batch.source, message: `Only ${Math.round(irrRate * 100)}% of funds have IRR — column alignment may be off` });
      }
    }
  }

  return { errors, warnings };
}

function checksumValidation(batches: SourceBatch[]): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const batch of batches) {
    const expected = EXPECTED_FUND_COUNTS[batch.source.split(":")[0]];
    if (!expected) continue;

    const ratio = batch.funds.length / expected.expected;
    if (ratio < 1 - expected.tolerance || ratio > 1 + expected.tolerance) {
      const msg = `Checksum: parsed ${batch.funds.length} vs expected ~${expected.expected} (${Math.round(ratio * 100)}%)`;
      if (ratio < 0.5) errors.push({ type: "checksum_mismatch", source: batch.source, message: msg });
      else warnings.push({ type: "low_fund_count", source: batch.source, message: msg });
    }
  }

  return { errors, warnings };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(fund|partners|capital|management|investments|advisors|llc|lp|inc|corp|co|ltd)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function crossSourceConsistency(allFunds: RawFundRecord[]): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const groups = new Map<string, RawFundRecord[]>();
  for (const fund of allFunds) {
    const key = `${normalizeName(fund.fund_name)}|${fund.vintage_year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fund);
  }

  for (const [, group] of groups) {
    const sources = new Set(group.map((f) => f.source.split(":")[0]));
    if (sources.size < 2) continue;

    const irrs = group.filter((f) => f.net_irr !== null).map((f) => ({ irr: f.net_irr!, source: f.source }));
    if (irrs.length < 2) continue;

    const spread = Math.max(...irrs.map((i) => i.irr)) - Math.min(...irrs.map((i) => i.irr));
    if (spread <= CROSS_SOURCE_IRR_TOLERANCE) continue;

    const detail = irrs.map((i) => `${i.source}: ${i.irr.toFixed(1)}%`).join(", ");
    if (spread > CROSS_SOURCE_IRR_TOLERANCE * 3) {
      errors.push({ type: "duplicate_inconsistency", fund: group[0].fund_name, message: `IRR spread ${spread.toFixed(1)}pp: ${detail}` });
    } else {
      warnings.push({ type: "unusual_irr", fund: group[0].fund_name, message: `IRR varies across sources (${spread.toFixed(1)}pp): ${detail}` });
    }
  }

  return { errors, warnings };
}

export function filterValidFunds(
  funds: RawFundRecord[],
  source: string
): { valid: RawFundRecord[]; rejected: number; errors: ValidationError[]; warnings: ValidationWarning[] } {
  const valid: RawFundRecord[] = [];
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  for (const fund of funds) {
    const { errors, warnings } = validateFund(fund);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
    if (errors.length === 0) valid.push(fund);
  }

  return { valid, rejected: funds.length - valid.length, errors: allErrors, warnings: allWarnings };
}

export function validateAll(batches: SourceBatch[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const bySource: ValidationStats["bySource"] = {};
  let totalParsed = 0;
  let totalValid = 0;

  for (const batch of batches) {
    let sourceValid = 0;
    let sourceErrors = 0;

    for (const fund of batch.funds) {
      const { errors, warnings } = validateFund(fund);
      allErrors.push(...errors);
      allWarnings.push(...warnings);
      if (errors.length === 0) sourceValid++;
      else sourceErrors += errors.length;
    }

    totalParsed += batch.funds.length;
    totalValid += sourceValid;
    bySource[batch.source] = { parsed: batch.funds.length, valid: sourceValid, errors: sourceErrors };
  }

  const health = checkParserHealth(batches);
  allErrors.push(...health.errors);
  allWarnings.push(...health.warnings);

  const checksums = checksumValidation(batches);
  allErrors.push(...checksums.errors);
  allWarnings.push(...checksums.warnings);

  const cross = crossSourceConsistency(batches.flatMap((b) => b.funds));
  allErrors.push(...cross.errors);
  allWarnings.push(...cross.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    stats: { totalParsed, totalValid, totalErrors: allErrors.length, totalWarnings: allWarnings.length, bySource },
  };
}

export function printValidationReport(result: ValidationResult): void {
  console.log("\n========== VALIDATION REPORT ==========");
  console.log(`Status: ${result.valid ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Parsed: ${result.stats.totalParsed} | Valid: ${result.stats.totalValid} | Errors: ${result.stats.totalErrors} | Warnings: ${result.stats.totalWarnings}`);

  for (const [source, stats] of Object.entries(result.stats.bySource)) {
    console.log(`  ${source}: ${stats.parsed} parsed, ${stats.valid} valid, ${stats.errors} errors`);
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    const byType = new Map<string, ValidationError[]>();
    for (const err of result.errors) {
      if (!byType.has(err.type)) byType.set(err.type, []);
      byType.get(err.type)!.push(err);
    }
    for (const [type, errs] of byType) {
      console.log(`  [${type}] (${errs.length})`);
      for (const err of errs.slice(0, 5)) {
        console.log(`    ${[err.source, err.fund].filter(Boolean).join(" / ")}: ${err.message}`);
      }
      if (errs.length > 5) console.log(`    ... and ${errs.length - 5} more`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    const byType = new Map<string, ValidationWarning[]>();
    for (const warn of result.warnings) {
      if (!byType.has(warn.type)) byType.set(warn.type, []);
      byType.get(warn.type)!.push(warn);
    }
    for (const [type, warns] of byType) {
      console.log(`  [${type}] (${warns.length})`);
      for (const warn of warns.slice(0, 3)) {
        console.log(`    ${[warn.source, warn.fund].filter(Boolean).join(" / ")}: ${warn.message}`);
      }
      if (warns.length > 3) console.log(`    ... and ${warns.length - 3} more`);
    }
  }

  console.log("========================================\n");
}