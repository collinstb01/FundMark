import { fetchCalSTRS } from "../src/parsers/calstrs";

async function main() {
  console.log("=== CalSTRS Parser Test ===\n");

  try {
    const funds = await fetchCalSTRS();
    console.log(`Funds: ${funds.length}`);

    if (funds.length === 0) {
      console.log("⚠️  No funds — PDF may not be accessible");
      return;
    }

    const allCalstrs = funds.every((f) => f.source === "calstrs");
    console.log(`${allCalstrs ? "✅" : "❌"} Source attribution`);

    const irrs = funds.filter((f) => f.net_irr !== null).map((f) => f.net_irr!);
    if (irrs.length > 0) {
      const avg = irrs.reduce((a, b) => a + b, 0) / irrs.length;
      console.log(`${Math.abs(avg) > 1 && Math.abs(avg) < 50 ? "✅" : "❌"} IRR format (avg: ${avg.toFixed(1)}%)`);
    }

    const vintages = funds.map((f) => f.vintage_year);
    console.log(`Vintage range: ${Math.min(...vintages)} - ${Math.max(...vintages)}`);

    console.log("\nSample:");
    for (const f of funds.slice(0, 5)) {
      console.log(`  ${f.fund_name} | VY:${f.vintage_year} | IRR:${f.net_irr !== null ? f.net_irr.toFixed(1) + "%" : "N/A"} | TVPI:${f.tvpi?.toFixed(2) || "N/A"}`);
    }
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

main();