import { RawFundRecord } from "../types";

const EDGAR_SEARCH_BASE = "https://efts.sec.gov/LATEST/search-index?q=";
const EDGAR_FULL_TEXT = "https://efts.sec.gov/LATEST/search-index";

interface FormDResult {
  fundName: string;
  cik?: string;
  entityName?: string;
  industryGroup?: string;
  investmentFundType?: string;
  stateOfOrganization?: string;
  filingDate?: string;
}

interface StrategyEnrichment {
  fund_name: string;
  suggested_strategy: string;
  confidence: "high" | "medium";
  source: "sec_form_d";
}

const FUND_TYPE_TO_STRATEGY: Record<string, string> = {
  "private equity fund": "buyout",
  "venture capital fund": "venture",
  "hedge fund": "buyout",
  "other investment fund": "buyout",
};

const INDUSTRY_TO_STRATEGY: Record<string, string> = {
  technology: "venture",
  biotechnology: "venture",
  "health care": "venture",
  "real estate": "real_estate",
  energy: "infrastructure",
  "oil & gas": "infrastructure",
  banking: "private_debt",
  lending: "private_debt",
};

const NAME_STRATEGY_HINTS: [RegExp, string][] = [
  [/\bventure\b/i, "venture"],
  [/\bgrowth\b/i, "growth"],
  [/\bbuyout\b/i, "buyout"],
  [/\blbo\b/i, "buyout"],
  [/\bleveraged\b/i, "buyout"],
  [/\bcredit\b/i, "private_debt"],
  [/\bdebt\b/i, "private_debt"],
  [/\bmezzanine\b/i, "private_debt"],
  [/\breal\s*estate\b/i, "real_estate"],
  [/\binfrastructure\b/i, "infrastructure"],
  [/\bsecondary\b|\bsecondaries\b/i, "secondaries"],
  [/\bfund\s*of\s*funds?\b/i, "fund_of_funds"],
];

async function searchEDGAR(fundName: string): Promise<FormDResult | null> {
  const cleanedName = fundName
    .replace(/,?\s*(L\.?P\.?|LLC|Inc\.?|Ltd\.?)$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const query = encodeURIComponent(`"${cleanedName}" AND "Form D"`);
  const url = `${EDGAR_FULL_TEXT}?q=${query}&dateRange=custom&startdt=2000-01-01&enddt=2026-12-31&forms=D`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FundMark-Research/1.0 research@fundmark.io",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as any;
    if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) return null;

    const hit = data.hits.hits[0];
    const source = hit._source || {};

    return {
      fundName,
      cik: source.entity_id,
      entityName: source.entity_name,
      industryGroup: source.industry_group,
      investmentFundType: source.investment_fund_type,
      stateOfOrganization: source.state_of_organization,
      filingDate: source.file_date,
    };
  } catch {
    return null;
  }
}

function inferStrategy(formD: FormDResult, originalName: string): StrategyEnrichment | null {
  if (formD.investmentFundType) {
    const lower = formD.investmentFundType.toLowerCase();
    for (const [key, strategy] of Object.entries(FUND_TYPE_TO_STRATEGY)) {
      if (lower.includes(key)) {
        return {
          fund_name: originalName,
          suggested_strategy: strategy,
          confidence: "high",
          source: "sec_form_d",
        };
      }
    }
  }

  if (formD.industryGroup) {
    const lower = formD.industryGroup.toLowerCase();
    for (const [key, strategy] of Object.entries(INDUSTRY_TO_STRATEGY)) {
      if (lower.includes(key)) {
        return {
          fund_name: originalName,
          suggested_strategy: strategy,
          confidence: "medium",
          source: "sec_form_d",
        };
      }
    }
  }

  const nameToCheck = formD.entityName || originalName;
  for (const [pattern, strategy] of NAME_STRATEGY_HINTS) {
    if (pattern.test(nameToCheck)) {
      return {
        fund_name: originalName,
        suggested_strategy: strategy,
        confidence: "medium",
        source: "sec_form_d",
      };
    }
  }

  return null;
}

export async function enrichFundsWithFormD(
  funds: RawFundRecord[],
  existingClassifier: (name: string) => any
): Promise<{ enriched: number; results: StrategyEnrichment[] }> {
  console.log("SEC Form D enrichment: checking unclassified funds...");

  const unclassified = funds.filter((f) => {
    if (f.source.includes(":")) return false;
    const existing = existingClassifier(f.fund_name);
    return !existing || existing.strategy === "unclassified";
  });

  console.log(`  ${unclassified.length} unclassified funds to check`);

  const results: StrategyEnrichment[] = [];
  let checked = 0;
  let enriched = 0;

  for (const fund of unclassified) {
    // Rate limit: SEC EDGAR allows 10 requests/second
    if (checked > 0 && checked % 10 === 0) {
      await new Promise((r) => setTimeout(r, 1100));
    }

    const formD = await searchEDGAR(fund.fund_name);
    checked++;

    if (formD) {
      const enrichment = inferStrategy(formD, fund.fund_name);
      if (enrichment) {
        results.push(enrichment);
        enriched++;
      }
    }

    if (checked % 50 === 0) {
      console.log(`  Checked ${checked}/${unclassified.length}, enriched ${enriched} so far`);
    }
  }

  console.log(`  Done: ${enriched}/${checked} funds enriched via Form D`);
  return { enriched, results };
}

export async function enrichSingle(fundName: string): Promise<StrategyEnrichment | null> {
  const formD = await searchEDGAR(fundName);
  if (!formD) return null;
  return inferStrategy(formD, fundName);
}

if (require.main === module) {
  const testFunds = [
    "Apollo Investment Fund IX",
    "Sequoia Capital Fund XV",
    "Blackstone Real Estate Partners IX",
    "Ares Corporate Opportunities Fund V",
  ];

  (async () => {
    console.log("=== SEC Form D Enrichment Test ===\n");
    for (const name of testFunds) {
      const result = await enrichSingle(name);
      if (result) {
        console.log(`✅ ${name} → ${result.suggested_strategy} (${result.confidence})`);
      } else {
        console.log(`⚪ ${name} → no Form D match`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  })();
}