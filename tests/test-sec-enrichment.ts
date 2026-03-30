import { enrichSingle } from "../src/enrichment/sec-form-d";

const TEST_FUNDS = [
  "Apollo Investment Fund IX",
  "Sequoia Capital Fund XV",
  "Blackstone Real Estate Partners IX",
  "Ares Corporate Opportunities Fund V",
  "Totally Fake Fund That Should Not Match",
];

async function main() {
  console.log("=== SEC Form D Enrichment Test ===\n");

  for (const name of TEST_FUNDS) {
    const result = await enrichSingle(name);
    if (result) {
      console.log(`✅ ${name} → ${result.suggested_strategy} (${result.confidence})`);
    } else {
      console.log(`⚪ ${name} → no match`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

main().catch((err) => {
  console.error("SEC test failed:", err);
  process.exit(1);
});