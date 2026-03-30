import { checkAllSources } from "../src/monitoring/source-monitor";

checkAllSources().then((results) => {
  const failures = results.filter((r) => r.status !== "ok");
  if (failures.length > 0) {
    console.log(`\n${failures.length} source(s) need attention.`);
  }
}).catch((err) => {
  console.error("Monitor test failed:", err);
  process.exit(1);
});