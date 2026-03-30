import { filterValidFunds, validateAll, printValidationReport, SourceBatch } from "../src/validation/validate";
import { RawFundRecord } from "../src/types";

function makeFund(overrides: Partial<RawFundRecord> = {}): RawFundRecord {
  return {
    fund_name: "Test Fund I",
    vintage_year: 2018,
    capital_committed: 500_000_000,
    cash_in: 450_000_000,
    cash_out: 540_000_000,
    remaining_value: 180_000_000,
    net_irr: 15.3,
    tvpi: 1.6,
    dpi: 1.2,
    source: "calpers",
    as_of_date: "2025-06-30",
    ...overrides,
  };
}

function makeBatch(funds: RawFundRecord[], source = "calpers", parseErrorCount = 0): SourceBatch {
  return { source, funds, parseErrorCount };
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err: any) {
    console.error(`❌ ${name}: ${err.message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== Validation Tests ===\n");

test("Valid fund passes", () => {
  const { valid } = filterValidFunds([makeFund()], "calpers");
  assert(valid.length === 1, `Expected 1 valid, got ${valid.length}`);
});

test("IRR > 500% rejected", () => {
  const { valid, errors } = filterValidFunds([makeFund({ net_irr: 600 })], "calpers");
  assert(valid.length === 0, "Should reject");
  assert(errors.some((e) => e.type === "irr_out_of_range"), "Expected irr_out_of_range");
});

test("IRR < -100% rejected", () => {
  const { errors } = filterValidFunds([makeFund({ net_irr: -150 })], "calpers");
  assert(errors.some((e) => e.type === "irr_out_of_range"), "Expected irr_out_of_range");
});

test("IRR 300% triggers warning not error", () => {
  const { valid, warnings } = filterValidFunds([makeFund({ net_irr: 300 })], "calpers");
  assert(valid.length === 1, "Should keep fund");
  assert(warnings.some((w) => w.type === "unusual_irr"), "Expected unusual_irr");
});

test("Empty fund name rejected", () => {
  const { valid } = filterValidFunds([makeFund({ fund_name: "" })], "calpers");
  assert(valid.length === 0, "Should reject");
});

test("Missing IRR is warning", () => {
  const { valid, warnings } = filterValidFunds([makeFund({ net_irr: null })], "calpers");
  assert(valid.length === 1, "Should keep");
  assert(warnings.some((w) => w.message.includes("IRR is missing")), "Expected warning");
});

test("DPI > TVPI rejected", () => {
  const { valid } = filterValidFunds([makeFund({ tvpi: 1.5, dpi: 2.0 })], "calpers");
  assert(valid.length === 0, "Should reject");
});

test("TVPI > 20x rejected", () => {
  const { errors } = filterValidFunds([makeFund({ tvpi: 25.0 })], "calpers");
  assert(errors.some((e) => e.type === "metric_out_of_range"), "Expected metric_out_of_range");
});

test("Stale data warning", () => {
  const { warnings } = filterValidFunds([makeFund({ as_of_date: "2024-01-01" })], "calpers");
  assert(warnings.some((w) => w.type === "stale_data"), "Expected stale_data");
});

test("Vintage 1970 rejected", () => {
  const { valid } = filterValidFunds([makeFund({ vintage_year: 1970 })], "calpers");
  assert(valid.length === 0, "Should reject");
});

test("Empty parser result flagged", () => {
  const result = validateAll([makeBatch([], "calpers")]);
  assert(result.errors.some((e) => e.type === "column_mismatch"), "Expected parser failure");
});

test("Low fund count flagged", () => {
  const funds = Array.from({ length: 100 }, (_, i) => makeFund({ fund_name: `Fund ${i}` }));
  const result = validateAll([makeBatch(funds, "calpers")]);
  assert(result.errors.some((e) => e.type === "column_mismatch" && e.source === "calpers"), "Expected low count");
});

test("Cross-source IRR discrepancy detected", () => {
  const result = validateAll([
    makeBatch([makeFund({ fund_name: "Apollo IX", net_irr: 20.0, source: "calpers" })], "calpers"),
    makeBatch([makeFund({ fund_name: "Apollo IX", net_irr: 8.0, source: "oregon" })], "oregon"),
  ]);
  const issues = [
    ...result.errors.filter((e) => e.type === "duplicate_inconsistency"),
    ...result.warnings.filter((w) => w.message.includes("varies across")),
  ];
  assert(issues.length > 0, "Expected cross-source flag");
});

test("Matching cross-source IRRs pass", () => {
  const result = validateAll([
    makeBatch([makeFund({ fund_name: "Apollo IX", net_irr: 15.0, source: "calpers" })], "calpers"),
    makeBatch([makeFund({ fund_name: "Apollo IX", net_irr: 16.0, source: "oregon" })], "oregon"),
  ]);
  const issues = [
    ...result.errors.filter((e) => e.type === "duplicate_inconsistency"),
    ...result.warnings.filter((w) => w.message.includes("varies across")),
  ];
  assert(issues.length === 0, `Expected 0 issues, got ${issues.length}`);
});

test("filterValidFunds separates valid from invalid", () => {
  const { valid, rejected } = filterValidFunds(
    [makeFund({ fund_name: "Good Fund" }), makeFund({ fund_name: "Bad Fund", net_irr: 1000 })],
    "calpers"
  );
  assert(valid.length === 1 && valid[0].fund_name === "Good Fund", "Wrong separation");
  assert(rejected === 1, `Expected 1 rejected, got ${rejected}`);
});

console.log("\n--- Sample Report ---");
printValidationReport(
  validateAll([
    makeBatch([
      makeFund({ fund_name: "Fund A", net_irr: 15.3 }),
      makeFund({ fund_name: "Fund B", net_irr: 700 }),
      makeFund({ fund_name: "", net_irr: 10 }),
      makeFund({ fund_name: "Fund D", tvpi: 1.0, dpi: 2.0 }),
    ]),
  ])
);