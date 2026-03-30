import "dotenv/config";
import { runIngestion } from "../src/ingest";

runIngestion().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});