export interface RawFundRecord {
  fund_name: string;
  vintage_year: number;
  capital_committed: number | null;
  cash_in: number | null;
  cash_out: number | null;
  remaining_value: number | null;
  net_irr: number | null;
  tvpi: number | null;
  dpi: number | null;
  source: string;
  as_of_date: string | null;
}

export interface NormalizedFund extends RawFundRecord {
  fund_id: string;
  manager: string;
  strategy: Strategy | "unclassified";
  geography: string;
}

export type Strategy =
  | "buyout"
  | "venture"
  | "growth"
  | "real_estate"
  | "infrastructure"
  | "private_debt"
  | "fund_of_funds"
  | "secondaries";

export interface BenchmarkQuery {
  strategy: Strategy;
  vintage_year: number;
  geography?: string;
}

export interface BenchmarkResult {
  strategy: string;
  vintage_year: number;
  geography: string;
  fund_count: number;
  median_net_irr: number | null;
  q1_threshold_irr: number | null;
  q3_threshold_irr: number | null;
  median_tvpi: number | null;
  median_dpi: number | null;
  as_of_date: string | null;
  sources: string[];
}

export interface FundLookupResult {
  fund_name: string;
  manager: string;
  vintage_year: number;
  strategy: string;
  net_irr: number | null;
  tvpi: number | null;
  dpi: number | null;
  peer_quartile: number | null;
  peer_fund_count: number;
  sources: string[];
  as_of_date: string | null;
}