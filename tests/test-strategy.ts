import { fetchCalPERS } from "../src/parsers/calpers";
import { fetchOregon } from "../src/parsers/oregon";
import { classifyStrategy, classifyFunds } from "../src/normalization/strategy";

async function main() {
  const calpers = await fetchCalPERS();
  const oregon = await fetchOregon();
  const allFunds = [...calpers, ...oregon];

  console.log(`\nTotal funds: ${allFunds.length}`);
  console.log("\n=== CLASSIFICATION STATS ===\n");
  classifyFunds(allFunds);

  const stratCounts: Record<string, number> = {};
  for (const fund of allFunds) {
    const { strategy } = classifyStrategy(fund.fund_name);
    stratCounts[strategy] = (stratCounts[strategy] || 0) + 1;
  }

  console.log("\nBreakdown:");
  Object.entries(stratCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, count]) => {
      console.log(`  ${s}: ${count} (${Math.round((count / allFunds.length) * 100)}%)`);
    });

  const unclassified = [...new Set(
    allFunds.filter((f) => classifyStrategy(f.fund_name).strategy === "unclassified").map((f) => f.fund_name)
  )];
  console.log(`\nUnclassified (${unclassified.length}):`);
  unclassified.slice(0, 15).forEach((name) => console.log(`  - ${name}`));
}

main().catch(console.error);