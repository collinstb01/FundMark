import * as cron from "node-cron";

interface SourceCheck {
  name: string;
  url: string | (() => Promise<string | null>);
  expectedContentPattern: RegExp;
  minContentLength: number;
}

interface MonitorResult {
  source: string;
  url: string;
  status: "ok" | "url_changed" | "format_changed" | "unreachable";
  httpStatus?: number;
  contentLength?: number;
  message: string;
  checkedAt: string;
}

const CALPERS_URL =
  "https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance-print";

const SOURCES: SourceCheck[] = [
  {
    name: "CalPERS",
    url: CALPERS_URL,
    expectedContentPattern: /vintage|irr|fund\s+name/i,
    minContentLength: 50000,
  },
  {
    name: "Oregon PERS",
    url: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const base = "https://www.oregon.gov/treasury/invested-for-oregon/Documents/Invested-for-OR-Performance-and-Holdings";
      for (let y = year; y >= year - 1; y--) {
        const maxQ = y === year ? quarter : 4;
        for (let q = maxQ; q >= 1; q--) {
          const url = `${base}/${y}/OPERF_Private_Equity_Portfolio_-_Quarter_${q}_${y}.pdf`;
          try {
            const res = await fetch(url, { method: "HEAD", redirect: "follow" });
            if (res.ok) return url;
          } catch { continue; }
        }
      }
      return null;
    },
    expectedContentPattern: /private\s+equity|net\s+irr|tvpi/i,
    minContentLength: 10000,
  },
  {
    name: "CalSTRS",
    url: "https://www.calstrs.com/private-equity-portfolio-performance-table",
    expectedContentPattern: /private\s+equity|irr|vintage/i,
    minContentLength: 1000,
  },
  {
    name: "WSIB",
    url: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      for (let y = year; y >= year - 1; y--) {
        const maxQ = y === year ? quarter : 4;
        for (let q = maxQ; q >= 1; q--) {
          const monthEnd = q * 3;
          const lastDay = new Date(y, monthEnd, 0).getDate();
          const mm = String(monthEnd).padStart(2, "0");
          const dd = String(lastDay).padStart(2, "0");
          const yy = String(y).slice(2);
          const url = `https://www.sib.wa.gov/docs/reports/quarterly/ir${mm}${dd}${yy}.pdf`;
          try {
            const res = await fetch(url, { method: "HEAD", redirect: "follow" });
            if (res.ok) return url;
          } catch { continue; }
        }
      }
      return null;
    },
    expectedContentPattern: /private\s+equity|irr|commitment/i,
    minContentLength: 10000,
  },
  {
    name: "Florida SBA",
    url: async () => {
      try {
        const page = "https://www.sbafla.com/reporting/alternative-asset-status-performance-report/";
        const res = await fetch(page, {
          headers: { "User-Agent": "FundMark-Research/1.0", Accept: "text/html" },
          redirect: "follow",
        });
        if (!res.ok) return null;
        const html = await res.text();
        const match = html.match(/href=["']([^"']*private[- _]?equity[^"']*\.pdf)["']/i);
        if (match) {
          const url = match[1].startsWith("http")
            ? match[1]
            : `https://www.sbafla.com${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
          return url;
        }
      } catch {}
      return null;
    },
    expectedContentPattern: /private\s+equity|irr|paid.in/i,
    minContentLength: 10000,
  },
];

async function resolveUrl(source: SourceCheck): Promise<string | null> {
  if (typeof source.url === "string") return source.url;
  return source.url();
}

async function checkSource(source: SourceCheck): Promise<MonitorResult> {
  const checkedAt = new Date().toISOString();

  const url = await resolveUrl(source);
  if (!url) {
    return {
      source: source.name,
      url: "(discovery failed)",
      status: "url_changed",
      message: "Could not discover current URL — source may have moved or restructured",
      checkedAt,
    };
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FundMark-Research/1.0" },
      redirect: "follow",
    });

    if (!res.ok) {
      return {
        source: source.name,
        url,
        status: "unreachable",
        httpStatus: res.status,
        message: `HTTP ${res.status} — source may be temporarily down or URL has changed`,
        checkedAt,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    const isPdf = contentType.includes("pdf") || url.endsWith(".pdf");

    if (isPdf) {
      const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
      if (contentLength > 0 && contentLength < source.minContentLength) {
        return {
          source: source.name,
          url,
          status: "format_changed",
          httpStatus: res.status,
          contentLength,
          message: `PDF size (${contentLength} bytes) unusually small — format may have changed`,
          checkedAt,
        };
      }

      return {
        source: source.name,
        url,
        status: "ok",
        httpStatus: res.status,
        contentLength,
        message: "PDF accessible and size looks normal",
        checkedAt,
      };
    }

    const text = await res.text();
    if (text.length < source.minContentLength) {
      return {
        source: source.name,
        url,
        status: "format_changed",
        httpStatus: res.status,
        contentLength: text.length,
        message: `Content too short (${text.length} chars vs expected ≥${source.minContentLength}) — format may have changed`,
        checkedAt,
      };
    }

    if (!source.expectedContentPattern.test(text)) {
      return {
        source: source.name,
        url,
        status: "format_changed",
        httpStatus: res.status,
        contentLength: text.length,
        message: `Content does not match expected pattern — page structure may have changed`,
        checkedAt,
      };
    }

    return {
      source: source.name,
      url,
      status: "ok",
      httpStatus: res.status,
      contentLength: text.length,
      message: "Source accessible and content matches expected format",
      checkedAt,
    };
  } catch (err) {
    return {
      source: source.name,
      url,
      status: "unreachable",
      message: `Fetch error: ${err}`,
      checkedAt,
    };
  }
}

export async function checkAllSources(): Promise<MonitorResult[]> {
  console.log("=== SOURCE URL MONITOR ===");
  console.log(`Checking ${SOURCES.length} sources at ${new Date().toISOString()}\n`);

  const results: MonitorResult[] = [];

  for (const source of SOURCES) {
    const result = await checkSource(source);
    results.push(result);

    const icon = result.status === "ok" ? "✅" : result.status === "unreachable" ? "❌" : "⚠️";
    console.log(`${icon} ${result.source}: ${result.status}`);
    if (result.status !== "ok") {
      console.log(`   ${result.message}`);
      console.log(`   URL: ${result.url}`);
    }
  }

  const failures = results.filter((r) => r.status !== "ok");
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length}/${results.length} sources have issues`);
  } else {
    console.log(`\n✅ All ${results.length} sources OK`);
  }

  console.log("========================\n");
  return results;
}

export function startWeeklyMonitor(): void {
  console.log("Starting weekly source URL monitor (every Sunday at 6:00 AM UTC)");

  cron.schedule("0 6 * * 0", async () => {
    try {
      const results = await checkAllSources();
      const failures = results.filter((r) => r.status !== "ok");
      if (failures.length > 0) {
        console.error(`[ALERT] ${failures.length} source(s) have issues:`);
        for (const f of failures) {
          console.error(`  - ${f.source}: ${f.status} — ${f.message}`);
        }
      }
    } catch (err) {
      console.error("[MONITOR] Weekly check failed:", err);
    }
  });
}

if (require.main === module) {
  checkAllSources().catch((err) => {
    console.error("Monitor failed:", err);
    process.exit(1);
  });
}