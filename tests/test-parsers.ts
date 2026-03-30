import { fetchCalPERS } from "../src/parsers/calpers";
import { fetchOregon } from "../src/parsers/oregon";

async function main() {
  console.log("=== CALPERS ===\n");
  const calpers = await fetchCalPERS();
  console.log(`Total: ${calpers.length} funds`);
  const withTVPI = calpers.filter((f) => f.tvpi !== null);
  const withIRR = calpers.filter((f) => f.net_irr !== null);
  console.log(`With TVPI: ${withTVPI.length} | With IRR: ${withIRR.length}`);
  console.log("Sample:", JSON.stringify(calpers[10], null, 2));

  console.log("\n=== OREGON ===\n");
  const oregon = await fetchOregon();
  console.log(`Total: ${oregon.length} funds`);
  if (oregon.length > 0) {
    console.log("Sample:", JSON.stringify(oregon[5], null, 2));
  }
}

main().catch(console.error);