import { Strategy } from "../types";

const MANAGER_MAP: Record<string, Strategy> = {
  // Buyout
  "apollo": "buyout", "blackstone capital": "buyout", "blackstone tactical": "buyout",
  "blackstone communications": "buyout", "blackstone energy": "buyout",
  "blackstone partners": "buyout", "blackstone tac ops": "buyout", "bcp tac ops": "buyout",
  "carlyle": "buyout", "kkr": "buyout", "bain capital": "buyout", "tpg": "buyout",
  "thoma bravo": "buyout", "vista equity": "buyout", "vista foundation": "buyout",
  "warburg pincus": "buyout", "hellman & friedman": "buyout", "h&f samson": "buyout",
  "leonard green": "buyout", "green equity investors": "buyout",
  "silver lake": "buyout", "advent international": "buyout", "advent global": "buyout",
  "advent latin": "buyout", "advent central": "buyout",
  "bc partners": "buyout", "bc european": "buyout", "bc clp": "buyout",
  "cvc capital": "buyout", "cvc european": "buyout", "eqt": "buyout",
  "permira": "buyout", "cinven": "buyout", "apax": "buyout", "bridgepoint": "buyout",
  "welsh carson": "buyout", "welsh, carson": "buyout", "wcas": "buyout",
  "gtcr": "buyout", "madison dearborn": "buyout", "american securities": "buyout",
  "american industrial": "buyout", "ares management": "buyout", "cerberus": "buyout",
  "clayton dubilier": "buyout", "clayton, dubilier": "buyout", "cd&r": "buyout",
  "fortress": "buyout", "genstar": "buyout", "golden gate": "buyout",
  "hicks muse": "buyout", "hicks, muse": "buyout", "kohlberg": "buyout",
  "onex": "buyout", "platinum equity": "buyout", "providence equity": "buyout",
  "providence media": "buyout", "roark capital": "buyout", "sycamore": "buyout",
  "veritas capital": "buyout", "pai partners": "buyout", "pai europe": "buyout",
  "montagu": "buyout", "charterhouse": "buyout",
  "hg capital": "buyout", "hg genesis": "buyout", "hg mercury": "buyout",
  "hg saturn": "buyout", "nordic capital": "buyout",
  "triton": "buyout", "ardian": "buyout", "eurazeo": "buyout",
  "centerbridge": "buyout", "sun capital": "buyout", "clearlake": "buyout",
  "francisco partners": "buyout", "hig capital": "buyout", "kelso": "buyout",
  "oak hill": "buyout", "riverside": "buyout", "sterling": "buyout",
  "tenex": "buyout", "audax": "buyout", "berkshire partners": "buyout",
  "berkshire fund": "buyout", "cortec": "buyout", "harvest partners": "buyout",
  "jordan": "buyout", "lindsey goldberg": "buyout", "lindsay goldberg": "buyout",
  "new mountain": "buyout", "stone point": "buyout", "thomas h. lee": "buyout",
  "acon equity": "buyout", "arsenal capital": "buyout", "equistone": "buyout",
  "castle harlan": "buyout", "diamond castle": "buyout", "doughty hanson": "buyout",
  "elevation partners": "buyout", "endeavour capital": "buyout",
  "fenway partners": "buyout", "fox paine": "buyout", "gi partners": "buyout",
  "greenbriar": "buyout", "gryphon partners": "buyout", "j.c. flowers": "buyout",
  "joseph, littlejohn": "buyout", "littlejohn fund": "buyout", "lion capital": "buyout",
  "mbk partners": "buyout", "odyssey investment": "buyout", "palamon european": "buyout",
  "parthenon investors": "buyout", "rhône partners": "buyout", "rhone partners": "buyout",
  "siris partners": "buyout", "solera partners": "buyout", "stonington capital": "buyout",
  "tdr capital": "buyout", "towerbrook": "buyout", "tsg capital": "buyout",
  "tsg consumer": "buyout", "vector capital": "buyout", "vitruvian": "buyout",
  "yucaipa": "buyout", "zell-chilmark": "buyout", "psg": "buyout",
  "trident": "buyout", "aquiline": "buyout", "cdh fund": "buyout",
  "north haven": "buyout", "pag asia": "buyout", "baring asia": "buyout",
  "the baring asia": "buyout", "baring vostok": "buyout", "orchid asia": "buyout",
  "affinity asia": "buyout", "rrj capital": "buyout", "patria brazilian": "buyout",
  "saif partners": "buyout", "rubicon partners": "buyout", "hsbc private equity": "buyout",
  "capital international private equity": "buyout", "the rise fund": "buyout",
  "crosspoint capital": "buyout", "prysm capital": "buyout", "coalesce capital": "buyout",
  "hedosophia": "buyout", "pophouse": "buyout", "top castle": "buyout",
  "verdane": "buyout", "whitney global": "buyout",

  // New buyout mappings
  "abry": "buyout", "actis": "buyout", "astorg": "buyout", "atlas capital": "buyout",
  "bgh capital": "buyout", "boston ventures": "buyout", "brentwood associates": "buyout",
  "brynwood": "buyout", "charlesbank": "buyout", "chartwell capital": "buyout",
  "chs private": "buyout", "code, hennessy": "buyout", "code hennessy": "buyout",
  "craton equity": "buyout", "cressey": "buyout", "cypress merchant": "buyout",
  "dbag": "buyout", "eci 10": "buyout", "equity-linked": "buyout",
  "fisher lynch": "buyout", "fountainvest": "buyout", "france private equity": "buyout",
  "gores small": "buyout", "hahn & company": "buyout", "hahn &": "buyout",
  "heritage fund": "buyout", "inflexion": "buyout", "investindustrial": "buyout",
  "j.h. whitney": "buyout", "kps special": "buyout", "l catterton": "buyout",
  "magnum industrial": "buyout", "peak rock": "buyout", "resolute fund": "buyout",
  "searchlight capital": "buyout", "tailwind capital": "buyout",
  "vestar capital": "buyout", "waterland": "buyout", "wpef": "buyout",
  "wellspring capital": "buyout", "wind point": "buyout", "wynnchurch": "buyout",
  "3i europartners": "buyout", "3i growth": "buyout",
  "gei jupiter": "buyout", "grandval": "buyout", "greenleaf co-invest": "buyout",
  "banc fund": "buyout", "bay state partners": "buyout", "alta communications": "buyout",
  "gold hills": "buyout", "gb palisade": "buyout", "cable & howse": "buyout",
  "coastal pacific": "buyout", "fourth street": "buyout", "california partners": "buyout",
  "centre capital": "buyout", "cypress equity": "buyout", "alchemy": "buyout",
  "aurora resurgence": "buyout", "ara fund": "buyout", "bond iii": "buyout",
  "ascent capital": "buyout", "gim lte": "buyout", "grantain": "buyout",
  "gsc i": "buyout", "evergreen i": "buyout", "evergreen iii": "buyout",
  "evergreen iv": "buyout", "forecastle": "buyout", "frozen investments": "buyout",
  "gaia investments": "buyout", "gorseway park": "buyout",
  "china privatization": "buyout", "california asia": "buyout",
  "cedar street": "buyout", "cap co-invest": "buyout",
  "southern cross": "buyout", "navis asia": "buyout",
  "hony capital": "buyout", "ffl capital": "buyout",
  "gilbert global": "buyout", "gridiron capital": "buyout",
  "olympus growth": "buyout", "sa co-invest": "buyout",
  "hggc": "buyout", "highland citrus": "buyout", "icv partners": "buyout",
  "jade equity": "buyout", "juniper capital": "buyout",
  "juniper high noon": "buyout", "k5 private": "buyout", "kba partners": "buyout",
  "liberty partners": "buyout", "lightbay": "buyout", "lincoln plaza": "buyout",
  "livingbridge": "buyout", "longrange capital": "buyout",
  "nautic partners": "buyout", "oncap": "buyout", "one peak": "buyout",
  "paragon partners": "buyout", "paragon fund": "buyout",
  "phoenix partners": "buyout", "pioneer pier": "buyout",
  "providence strategic growth": "buyout", "q-street capital": "buyout",
  "red admiral": "buyout", "redwood lane": "buyout",
  "reverence cap": "buyout", "rice partners": "buyout",
  "ripplewood": "buyout", "river city investments": "buyout",
  "rubicon technology": "buyout", "samson partners": "buyout",
  "set builders": "buyout", "sierra partners": "buyout",
  "snow phipps": "buyout", "springblue": "buyout",
  "stride consumer": "buyout", "sunrise boulevard": "buyout",
  "thoma cressey": "buyout", "tiger iron": "buyout",
  "timber coast": "buyout", "triangle investment": "buyout",
  "trive capital": "buyout", "vistria fund": "buyout",
  "willis stein": "buyout", "wpp cmi": "buyout",
  "hf project": "buyout", "hf samson": "buyout",
  "hgcapital": "buyout", "hipep": "fund_of_funds",
  "highland": "buyout", "hufridy": "buyout",
  "investitori associati": "buyout",

  // New venture from tail
  "interwest partners": "venture", "shasta ventures": "venture",
  "sprout capital": "venture", "mobius technology": "venture",
  "ventech partners": "venture", "vivo capital": "venture",
  "materia ventures": "venture", "innovation opportunities": "venture",
  "truebridge": "venture", "menlo evergreen": "venture",
  "menlo inflection": "venture", "menlo olympic": "venture",
  "windrose health": "venture",

  // New infrastructure from tail
  "post oak energy": "infrastructure", "quantum energy": "infrastructure",
  "the energy & minerals": "infrastructure", "tiger iron redwood": "infrastructure",

  // New private debt from tail
  "sixth street": "private_debt", "tssp": "private_debt",
  "magnolia opportunities": "buyout",

  // New secondaries from tail
  "lexington cip": "secondaries", "lexington middle market": "secondaries",
  "pomona capital": "secondaries",

  // New fund of funds from tail
  "truebridge capital fsa": "fund_of_funds", "truebridge-kauffman": "fund_of_funds",
  "strategic investors fund": "venture", "strategic investors v": "venture",
  "strategic investors vi": "venture", "strategic investors vii": "venture",
  "strategic investors viii": "venture", "strategic investors ix": "venture",
  "strategic investors x": "venture",
  "rcp fund": "fund_of_funds",

  // Venture Capital
  "sequoia": "venture", "andreessen horowitz": "venture", "a16z": "venture",
  "accel": "venture", "benchmark": "venture", "bessemer": "venture",
  "greylock": "venture", "kleiner perkins": "venture", "lightspeed": "venture",
  "nea": "venture", "new enterprise associates": "venture", "khosla": "venture",
  "battery ventures": "venture", "general catalyst": "venture",
  "index ventures": "venture", "ivp": "venture", "institutional venture": "venture",
  "menlo ventures": "venture", "norwest venture": "venture", "redpoint": "venture",
  "spark capital": "venture", "union square": "venture", "usv": "venture",
  "foundry group": "venture", "first round": "venture", "ggv": "venture",
  "matrix partners": "venture", "sapphire ventures": "venture", "tcv": "venture",
  "technology crossover": "venture", "thrive capital": "venture",
  "tiger global": "venture", "coatue": "venture", "durable capital": "venture",
  "dragoneer": "venture", "dst global": "venture", "blue run": "venture",
  "oak investment": "venture", "orbimed": "venture", "austin ventures": "venture",
  "brv": "venture", "bvp": "venture", "mayfield": "venture", "canaan": "venture",
  "acrew capital": "venture", "acrew diversify": "venture", "b capital": "venture",
  "balderton": "venture", "base10": "venture", "biogeneration": "venture",
  "essex woodlands": "venture", "focus ventures": "venture", "forbion": "venture",
  "granite ventures": "venture", "griffin gaming": "venture", "hongshan": "venture",
  "lux ventures": "venture", "northwest emerging": "venture", "oak hc/ft": "venture",
  "signalfire": "venture", "sr one": "venture", "otro capital": "venture",
  "bear coast": "venture", "bear technology": "venture", "coefficient capital": "venture",

  // New venture mappings
  "svb strategic": "venture", "svb cap": "venture", "svb sif": "venture",
  "frazier healthcare": "venture", "dcm ": "venture",
  "nic wisteria": "venture", "bci growth": "venture", "clearvue": "venture",
  "gc customer value": "venture", "openview venture": "venture",
  "pond ventures": "venture", "ovp venture": "venture",
  "lav biosciences": "venture", "lav fund": "venture",
  "northwest venture": "venture",

  // Growth Equity
  "insight partners": "growth", "summit partners": "growth",
  "ta associates": "growth", "ta xi": "growth", "ta xii": "growth",
  "ta xiii": "growth", "ta xiv": "growth", "ta xv": "growth",
  "general atlantic": "growth", "jmi equity": "growth",
  "spectrum equity": "growth", "alpine investors": "growth",
  "olympus": "growth", "aacp": "growth",

  // New growth mappings
  "ga continuity": "growth",

  // Real Estate
  "blackstone real estate": "real_estate", "brookfield real estate": "real_estate",
  "starwood": "real_estate", "lone star": "real_estate",
  "colony capital": "real_estate", "carlyle realty": "real_estate",
  "jamestown": "real_estate", "prologis": "real_estate",
  "ares real estate": "real_estate", "harrison street": "real_estate",
  "invesco real estate": "real_estate", "blackrock asset investors": "real_estate",

  // Infrastructure / Energy
  "macquarie infrastructure": "infrastructure", "brookfield infrastructure": "infrastructure",
  "global infrastructure": "infrastructure", "stonepeak": "infrastructure",
  "arclight": "infrastructure", "i squared": "infrastructure",
  "antin infrastructure": "infrastructure", "first reserve": "infrastructure",
  "encap energy": "infrastructure", "lime rock": "infrastructure",
  "riverstone": "infrastructure", "vantagepoint cleantech": "infrastructure",

  // New infrastructure/energy mappings
  "carnelian energy": "infrastructure", "denham commodity": "infrastructure",
  "denham oil": "infrastructure", "encap flatrock": "infrastructure",
  "energy spectrum": "infrastructure", "enervest energy": "infrastructure",
  "asper renewable": "infrastructure", "gso energy": "infrastructure",
  "blue water energy": "infrastructure",

  // Private Debt / Credit
  "ares capital": "private_debt", "ares corporate": "private_debt",
  "golub capital": "private_debt",
  "owl rock": "private_debt", "blue owl": "private_debt",
  "monroe capital": "private_debt", "crescent capital": "private_debt",
  "bdcm": "private_debt", "bdc ": "private_debt", "oaktree": "private_debt",
  "och-ziff": "private_debt", "ocm opportunities": "private_debt",
  "tcw special credits": "private_debt", "mhr institutional": "private_debt",
  "matlinpatterson": "private_debt", "wlr recovery": "private_debt",
  "montauk triguard": "private_debt", "oha ": "private_debt",
  "gso energy": "private_debt",

  // New private debt mappings
  "capital resource lenders": "private_debt", "capital resource partners": "private_debt",
  "castlelake": "private_debt", "contrarian capital": "private_debt",
  "gso capital solutions": "private_debt", "ds opportunities": "private_debt",
  "arbor debt": "private_debt",

  // Fund of Funds
  "adams street": "fund_of_funds", "hamilton lane": "fund_of_funds",
  "pantheon": "fund_of_funds", "harbourvest": "fund_of_funds",
  "pathway": "fund_of_funds", "neuberger berman": "fund_of_funds",
  "stepstone": "fund_of_funds", "gcm grosvenor": "fund_of_funds",
  "public pension capital": "fund_of_funds", "emalternatives": "fund_of_funds",

  // New fund of funds mappings
  "grove street": "fund_of_funds", "gs partners": "fund_of_funds",
  "asia alternatives": "fund_of_funds", "fairview ventures": "fund_of_funds",
  "fco ma": "fund_of_funds", "fsba aam": "fund_of_funds",
  "paul capital top tier": "fund_of_funds",

  // Secondaries
  "lexington partners": "secondaries", "ardian secondary": "secondaries",
  "coller capital": "secondaries", "coller international": "secondaries",
  "whitehorse liquidity": "secondaries", "landmark partners": "secondaries",
  "strategic partners": "secondaries",

  // New secondaries mappings
  "alpinvest c fund": "secondaries", "lexington co-investment": "secondaries",
  "lcp fsba": "secondaries",
};

const NAME_PATTERNS: Array<{ pattern: RegExp; strategy: Strategy }> = [
  { pattern: /\breal\s*estate\b/i, strategy: "real_estate" },
  { pattern: /\brealty\b/i, strategy: "real_estate" },
  { pattern: /\bproperty\b/i, strategy: "real_estate" },
  { pattern: /\breit\b/i, strategy: "real_estate" },
  { pattern: /\binfrastructure\b/i, strategy: "infrastructure" },
  { pattern: /\benergy\s+(capital\s+)?fund\b/i, strategy: "infrastructure" },
  { pattern: /\bclean\s*energy\b/i, strategy: "infrastructure" },
  { pattern: /\bcleantech\b/i, strategy: "infrastructure" },
  { pattern: /\bresources?\s+fund\b/i, strategy: "infrastructure" },
  { pattern: /\bpower\s+fund\b/i, strategy: "infrastructure" },
  { pattern: /\bpower\s+partners\b/i, strategy: "infrastructure" },
  { pattern: /\bmidstream\b/i, strategy: "infrastructure" },
  { pattern: /\benergy\b/i, strategy: "infrastructure" },
  { pattern: /\brenewable\b/i, strategy: "infrastructure" },
  { pattern: /\boil\s+(&|and)\s+gas\b/i, strategy: "infrastructure" },
  { pattern: /\bcommodity\b/i, strategy: "infrastructure" },
  { pattern: /\bcredit\b/i, strategy: "private_debt" },
  { pattern: /\bdebt\b/i, strategy: "private_debt" },
  { pattern: /\bmezzanine\b/i, strategy: "private_debt" },
  { pattern: /\blending\b/i, strategy: "private_debt" },
  { pattern: /\bsubordinated\b/i, strategy: "private_debt" },
  { pattern: /\bdistressed\b/i, strategy: "private_debt" },
  { pattern: /\bspecial\s+situations?\b/i, strategy: "private_debt" },
  { pattern: /\brecovery\s+fund\b/i, strategy: "private_debt" },
  { pattern: /\bopportunit(?:y|ies)\s+fund\b/i, strategy: "private_debt" },
  { pattern: /\bventure\b/i, strategy: "venture" },
  { pattern: /\bvc\s+fund\b/i, strategy: "venture" },
  { pattern: /\bseed\b/i, strategy: "venture" },
  { pattern: /\bearly\s+stage\b/i, strategy: "venture" },
  { pattern: /\bhealthcare\s+fund\b/i, strategy: "venture" },
  { pattern: /\blife\s+science/i, strategy: "venture" },
  { pattern: /\bemerging\s+ventures?\b/i, strategy: "venture" },
  { pattern: /\bgrowth\s+equity\b/i, strategy: "growth" },
  { pattern: /\bgrowth\s+fund\b/i, strategy: "growth" },
  { pattern: /\bgrowth\s+partners\b/i, strategy: "growth" },
  { pattern: /\bgrowth\s+investors\b/i, strategy: "growth" },
  { pattern: /\bexpansion\s+fund\b/i, strategy: "growth" },
  { pattern: /\bascent\s+fund\b/i, strategy: "growth" },
  { pattern: /\bglobal\s+growth\b/i, strategy: "growth" },
  { pattern: /\bgrowth\s+cap/i, strategy: "growth" },
  { pattern: /\bfund[\s-]*of[\s-]*funds?\b/i, strategy: "fund_of_funds" },
  { pattern: /\bfof\b/i, strategy: "fund_of_funds" },
  { pattern: /\bsecondar(?:y|ies)\b/i, strategy: "secondaries" },
  { pattern: /\bprivate\s+equity\b/i, strategy: "buyout" },
  { pattern: /\bco[\s-]*invest/i, strategy: "buyout" },
  { pattern: /\bbuyout\b/i, strategy: "buyout" },
  { pattern: /\blbo\b/i, strategy: "buyout" },
  { pattern: /\bleveraged\b/i, strategy: "buyout" },
  { pattern: /\bacquisition\b/i, strategy: "buyout" },
  { pattern: /\bcapital\s+partners\b/i, strategy: "buyout" },
  { pattern: /\bequity\s+partners\b/i, strategy: "buyout" },
  { pattern: /\bequity\s+fund\b/i, strategy: "buyout" },
  { pattern: /\bcorporate\s+partners\b/i, strategy: "buyout" },
  { pattern: /\binvestment\s+fund\b/i, strategy: "buyout" },
];

const CO_INVEST_PATTERNS = [/\bco[\s-]*invest/i, /\bdirect\s+invest/i];

export function classifyStrategy(fundName: string): {
  strategy: Strategy | "unclassified";
  confidence: "high" | "medium" | "low";
  is_coinvestment: boolean;
} {
  const lowerName = fundName.toLowerCase();
  const is_coinvestment = CO_INVEST_PATTERNS.some((p) => p.test(fundName));

  const sortedManagers = Object.entries(MANAGER_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [manager, strategy] of sortedManagers) {
    if (lowerName.includes(manager)) {
      for (const { pattern, strategy: nameStrategy } of NAME_PATTERNS) {
        if (pattern.test(fundName) && nameStrategy !== strategy) {
          return { strategy: nameStrategy, confidence: "high", is_coinvestment };
        }
      }
      return { strategy, confidence: "high", is_coinvestment };
    }
  }

  for (const { pattern, strategy } of NAME_PATTERNS) {
    if (pattern.test(fundName)) {
      return { strategy, confidence: "medium", is_coinvestment };
    }
  }

  return { strategy: "unclassified", confidence: "low", is_coinvestment };
}

export function classifyFunds(
  funds: Array<{ fund_name: string }>
): Map<string, { strategy: Strategy | "unclassified"; confidence: string; is_coinvestment: boolean }> {
  const results = new Map<string, { strategy: Strategy | "unclassified"; confidence: string; is_coinvestment: boolean }>();
  let high = 0, medium = 0, low = 0;

  for (const fund of funds) {
    const result = classifyStrategy(fund.fund_name);
    results.set(fund.fund_name, result);
    if (result.confidence === "high") high++;
    else if (result.confidence === "medium") medium++;
    else low++;
  }

  console.log(
    `Strategy classification: ${high} high (${Math.round((high / funds.length) * 100)}%), ` +
    `${medium} medium (${Math.round((medium / funds.length) * 100)}%), ` +
    `${low} unclassified (${Math.round((low / funds.length) * 100)}%)`
  );

  return results;
}