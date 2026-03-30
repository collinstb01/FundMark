import { fetchCalPERS } from './parsers/calpers';
import { fetchOregon } from './parsers/oregon';
import { fetchCalSTRS } from './parsers/calstrs';
import { fetchWSIB } from './parsers/wsib';
import { fetchFlorida } from './parsers/florida';
import { deduplicateFunds } from './normalization/dedup';
import { classifyStrategy } from './normalization/strategy';
import { initDB, createTables, upsertFunds, getAvailableBenchmarks, closeDB } from './db/database';
import { validateAll, filterValidFunds, printValidationReport, SourceBatch } from './validation/validate';
import { enrichFundsWithFormD } from './enrichment/sec-form-d';
import { RawFundRecord } from './types';

const SOURCES = [
  { name: "CalPERS", key: "calpers", fetcher: fetchCalPERS },
  { name: "Oregon PERS", key: "oregon", fetcher: fetchOregon },
  { name: "CalSTRS", key: "calstrs", fetcher: fetchCalSTRS },
  { name: "WSIB", key: "wsib", fetcher: fetchWSIB },
  { name: "Florida SBA", key: "florida", fetcher: fetchFlorida },
];

export async function runIngestion(databaseUrl?: string): Promise<void> {
  console.log('=== FUNDMARK INGESTION PIPELINE ===\n');
  const startTime = Date.now();

  console.log('Step 1: Connecting to database...');
  initDB(databaseUrl);
  await createTables();

  console.log('\nStep 2: Fetching from pension sources...');
  const batches: SourceBatch[] = [];

  for (const src of SOURCES) {
    try {
      const t0 = Date.now();
      const funds = await src.fetcher();
      console.log(`  ✅ ${src.name}: ${funds.length} funds in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      batches.push({ source: src.key, funds, parseErrorCount: 0 });
    } catch (err) {
      console.error(`  ❌ ${src.name}: ${(err as Error).message}`);
      batches.push({ source: src.key, funds: [], parseErrorCount: 1 });
    }
  }

  const totalRaw = batches.reduce((sum, b) => sum + b.funds.length, 0);
  console.log(`\nTotal raw records: ${totalRaw}`);

  if (totalRaw === 0) {
    console.error('No data fetched from any source. Aborting.');
    await closeDB();
    return;
  }

  console.log('\nStep 3: Validation...');
  const validation = validateAll(batches);
  printValidationReport(validation);

  const validatedFunds: RawFundRecord[] = [];
  for (const batch of batches) {
    const { valid } = filterValidFunds(batch.funds, batch.source);
    validatedFunds.push(...valid);
  }

  console.log(`Passed: ${validatedFunds.length}/${totalRaw} (${totalRaw - validatedFunds.length} rejected)`);

  if (validatedFunds.length < totalRaw * 0.5 && totalRaw > 100) {
    console.error('ABORT: >50% of funds failed validation');
    await closeDB();
    return;
  }

  console.log('\nStep 4: SEC Form D enrichment...');
  try {
    const { enriched, results } = await enrichFundsWithFormD(validatedFunds, classifyStrategy);
    console.log(`  Enriched ${enriched} funds via SEC Form D`);
  } catch (err) {
    console.warn(`  SEC enrichment skipped: ${(err as Error).message}`);
  }

  console.log('\nStep 5: Deduplicating and normalizing...');
  const funds = deduplicateFunds(validatedFunds);
  console.log(`  ${validatedFunds.length} → ${funds.length} unique (${validatedFunds.length - funds.length} merged)`);

  console.log('\nStep 6: Storing in database...');
  await upsertFunds(funds);

  console.log('\nStep 7: Available benchmark cells (≥15 funds with IRR):');
  const benchmarks = await getAvailableBenchmarks();
  if (benchmarks.length === 0) {
    console.log('  No benchmark cells meet the ≥15 fund threshold yet');
  } else {
    for (const b of benchmarks) {
      console.log(`  ${b.strategy} | ${b.vintage_year} | ${b.fund_count} funds`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sourceCount = batches.filter((b) => b.funds.length > 0).length;
  console.log(`\n=== INGESTION COMPLETE (${elapsed}s) | ${sourceCount} sources | ${totalRaw} raw | ${validatedFunds.length} valid | ${funds.length} unique ===`);

  await closeDB();
}

if (require.main === module) {
  runIngestion().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}