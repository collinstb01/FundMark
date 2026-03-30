import { Pool } from 'pg';
import { NormalizedFund, BenchmarkResult, FundLookupResult, Strategy } from '../types';

let pool: Pool;

export function initDB(databaseUrl?: string): Pool {
  pool = new Pool({
    connectionString: databaseUrl || process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return pool;
}

export async function createTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funds (
      fund_id TEXT PRIMARY KEY,
      fund_name TEXT NOT NULL,
      manager TEXT NOT NULL,
      vintage_year INTEGER NOT NULL,
      strategy TEXT NOT NULL DEFAULT 'unclassified',
      geography TEXT NOT NULL DEFAULT 'US',
      capital_committed DOUBLE PRECISION,
      cash_in DOUBLE PRECISION,
      cash_out DOUBLE PRECISION,
      remaining_value DOUBLE PRECISION,
      net_irr DOUBLE PRECISION,
      tvpi DOUBLE PRECISION,
      dpi DOUBLE PRECISION,
      source TEXT NOT NULL,
      as_of_date TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_funds_strategy ON funds(strategy);
    CREATE INDEX IF NOT EXISTS idx_funds_vintage ON funds(vintage_year);
    CREATE INDEX IF NOT EXISTS idx_funds_strategy_vintage ON funds(strategy, vintage_year);
  `);
  console.log('Database tables created');
}

export async function upsertFunds(funds: NormalizedFund[]): Promise<number> {
  let count = 0;
  for (const fund of funds) {
    await pool.query(
      `INSERT INTO funds (
        fund_id, fund_name, manager, vintage_year, strategy, geography,
        capital_committed, cash_in, cash_out, remaining_value,
        net_irr, tvpi, dpi, source, as_of_date, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
      ON CONFLICT (fund_id) DO UPDATE SET
        net_irr = COALESCE(EXCLUDED.net_irr, funds.net_irr),
        tvpi = COALESCE(EXCLUDED.tvpi, funds.tvpi),
        dpi = COALESCE(EXCLUDED.dpi, funds.dpi),
        capital_committed = COALESCE(EXCLUDED.capital_committed, funds.capital_committed),
        cash_in = COALESCE(EXCLUDED.cash_in, funds.cash_in),
        cash_out = COALESCE(EXCLUDED.cash_out, funds.cash_out),
        remaining_value = COALESCE(EXCLUDED.remaining_value, funds.remaining_value),
        source = EXCLUDED.source,
        as_of_date = COALESCE(EXCLUDED.as_of_date, funds.as_of_date),
        updated_at = NOW()`,
      [
        fund.fund_id, fund.fund_name, fund.manager, fund.vintage_year,
        fund.strategy, fund.geography,
        fund.capital_committed, fund.cash_in, fund.cash_out, fund.remaining_value,
        fund.net_irr, fund.tvpi, fund.dpi, fund.source, fund.as_of_date,
      ]
    );
    count++;
  }
  console.log(`Upserted ${count} funds into database`);
  return count;
}

// === QUARTILE COMPUTATION ===

const MIN_FUNDS_FOR_QUARTILE = 15;

export async function getBenchmark(
  strategy: string,
  vintageYear: number,
  geography: string = 'US'
): Promise<BenchmarkResult> {
  // Get all funds matching the filter that have IRR data
  const result = await pool.query(
    `SELECT fund_name, net_irr, tvpi, dpi, source, as_of_date
     FROM funds
     WHERE strategy = $1
       AND vintage_year = $2
       AND geography = $3
       AND net_irr IS NOT NULL
     ORDER BY net_irr DESC`,
    [strategy, vintageYear, geography]
  );

  const funds = result.rows;
  const sources = [...new Set(funds.map((f: any) => f.source.split(',')).flat())] as string[];
  const latestDate = funds.reduce(
    (max: string | null, f: any) => (!max || (f.as_of_date && f.as_of_date > max) ? f.as_of_date : max),
    null as string | null
  );

  if (funds.length === 0) {
    return {
      strategy,
      vintage_year: vintageYear,
      geography,
      fund_count: 0,
      median_net_irr: null,
      q1_threshold_irr: null,
      q3_threshold_irr: null,
      median_tvpi: null,
      median_dpi: null,
      as_of_date: null,
      sources: [],
    };
  }

  const irrs = funds.map((f: any) => f.net_irr as number);
  const tvpis = funds.filter((f: any) => f.tvpi !== null).map((f: any) => f.tvpi as number);
  const dpis = funds.filter((f: any) => f.dpi !== null).map((f: any) => f.dpi as number);

  // Only compute quartiles if we have enough funds
  let q1: number | null = null;
  let q3: number | null = null;

  if (funds.length >= MIN_FUNDS_FOR_QUARTILE) {
    q1 = percentile(irrs, 75); // Q1 = top quartile threshold (75th percentile)
    q3 = percentile(irrs, 25); // Q3 = bottom quartile threshold (25th percentile)
  }

  return {
    strategy,
    vintage_year: vintageYear,
    geography,
    fund_count: funds.length,
    median_net_irr: percentile(irrs, 50),
    q1_threshold_irr: q1,
    q3_threshold_irr: q3,
    median_tvpi: tvpis.length > 0 ? percentile(tvpis, 50) : null,
    median_dpi: dpis.length > 0 ? percentile(dpis, 50) : null,
    as_of_date: latestDate,
    sources,
  };
}

export async function lookupFund(
  fundName: string
): Promise<FundLookupResult | null> {
  // Search by partial match
  const result = await pool.query(
    `SELECT * FROM funds
     WHERE LOWER(fund_name) LIKE $1
     ORDER BY vintage_year DESC
     LIMIT 1`,
    [`%${fundName.toLowerCase()}%`]
  );

  if (result.rows.length === 0) return null;

  const fund = result.rows[0];

  // Get peer quartile
  let peerQuartile: number | null = null;
  let peerCount = 0;

  if (fund.net_irr !== null && fund.strategy !== 'unclassified') {
    const peers = await pool.query(
      `SELECT net_irr FROM funds
       WHERE strategy = $1
         AND vintage_year = $2
         AND geography = $3
         AND net_irr IS NOT NULL
       ORDER BY net_irr DESC`,
      [fund.strategy, fund.vintage_year, fund.geography]
    );

    peerCount = peers.rows.length;

    if (peerCount >= MIN_FUNDS_FOR_QUARTILE) {
      const irrs = peers.rows.map((r: any) => r.net_irr as number);
      const rank = irrs.filter((irr: number) => irr >= fund.net_irr).length;
      const pctile = rank / irrs.length;

      if (pctile <= 0.25) peerQuartile = 1;
      else if (pctile <= 0.5) peerQuartile = 2;
      else if (pctile <= 0.75) peerQuartile = 3;
      else peerQuartile = 4;
    }
  }

  return {
    fund_name: fund.fund_name,
    manager: fund.manager,
    vintage_year: fund.vintage_year,
    strategy: fund.strategy,
    net_irr: fund.net_irr,
    tvpi: fund.tvpi,
    dpi: fund.dpi,
    peer_quartile: peerQuartile,
    peer_fund_count: peerCount,
    sources: fund.source.split(','),
    as_of_date: fund.as_of_date,
  };
}

export async function getAvailableBenchmarks(): Promise<
  Array<{ strategy: string; vintage_year: number; fund_count: number }>
> {
  const result = await pool.query(
    `SELECT strategy, vintage_year, COUNT(*) as fund_count
     FROM funds
     WHERE net_irr IS NOT NULL AND strategy != 'unclassified'
     GROUP BY strategy, vintage_year
     HAVING COUNT(*) >= $1
     ORDER BY strategy, vintage_year`,
    [MIN_FUNDS_FOR_QUARTILE]
  );
  return result.rows;
}

export async function getTotalFundCount(): Promise<number> {
  const result = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM funds`,
  );
  return Number(result.rows[0]?.c ?? 0);
}

// === HELPERS ===

function percentile(sorted: number[], pct: number): number {
  // sorted should already be in descending order from SQL
  const asc = [...sorted].sort((a, b) => a - b);
  const index = (pct / 100) * (asc.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Math.round(asc[lower] * 100) / 100;
  const weight = index - lower;
  return Math.round((asc[lower] * (1 - weight) + asc[upper] * weight) * 100) / 100;
}

export async function closeDB(): Promise<void> {
  await pool.end();
}