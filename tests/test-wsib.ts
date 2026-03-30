import { fetchWSIB } from "../src/parsers/wsib";

async function main() {
  console.log("=== WSIB Parser Test ===\n");

  try {
    const funds = await fetchWSIB();
    console.log(`Funds: ${funds.length}`);

    if (funds.length === 0) {
      console.log("⚠️  No funds — PDF may not be discoverable");
      return;
    }

    const sources = new Set(funds.map((f) => f.source));
    console.log(`Sources: ${[...sources].join(", ")}`);

    const withStrategy = funds.filter((f) => f.source.includes(":"));
    console.log(`Strategy-tagged: ${withStrategy.length}/${funds.length} (${Math.round((withStrategy.length / funds.length) * 100)}%)`);

    const irrs = funds.filter((f) => f.net_irr !== null).map((f) => f.net_irr!);
    if (irrs.length > 0) {
      const avg = irrs.reduce((a, b) => a + b, 0) / irrs.length;
      console.log(`${Math.abs(avg) > 1 && Math.abs(avg) < 50 ? "✅" : "❌"} IRR format (avg: ${avg.toFixed(1)}%)`);
    }

    console.log("\nSample:");
    for (const f of funds.slice(0, 5)) {
      console.log(`  ${f.fund_name} | VY:${f.vintage_year} | IRR:${f.net_irr !== null ? f.net_irr.toFixed(1) + "%" : "N/A"} | Src:${f.source}`);
    }
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

main();