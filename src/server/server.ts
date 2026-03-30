import "dotenv/config";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createContextMiddleware } from "@ctxprotocol/sdk";
import { initDB, getBenchmark, lookupFund, getAvailableBenchmarks } from "../db/database";
import { startWeeklyMonitor } from "../monitoring/source-monitor";

const TOOLS = [
  {
    name: "get_fund_benchmarks",
    description:
      "Get private fund performance benchmarks (median IRR, TVPI, DPI, quartile thresholds) for a given strategy, vintage year, and geography. Data sourced from public pension FOIA disclosures (CalPERS, CalSTRS, Oregon PERS, WSIB, Florida SBA). Quartiles only computed when ≥15 funds exist in the cell.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "instant",
      pricing: {
        executeUsd: "0.001",
      },
      rateLimit: {
        maxRequestsPerMinute: 60,
        cooldownMs: 1000,
        maxConcurrency: 5,
      },
    },
    inputSchema: {
      type: "object" as const,
      properties: {
        strategy: {
          type: "string",
          description: "Fund strategy to benchmark",
          enum: [
            "buyout",
            "venture",
            "growth",
            "real_estate",
            "infrastructure",
            "private_debt",
            "fund_of_funds",
            "secondaries",
          ],
          default: "buyout",
          examples: ["buyout", "venture", "growth"],
        },
        vintage_year: {
          type: "number",
          description: "Vintage year of the fund (year of first capital call)",
          default: 2019,
          examples: [2015, 2018, 2019, 2020, 2021],
        },
        geography: {
          type: "string",
          description: "Geographic focus of the funds",
          default: "US",
          examples: ["US"],
        },
      },
      required: ["strategy", "vintage_year"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        strategy: { type: "string", description: "Fund strategy queried" },
        vintage_year: { type: "number", description: "Vintage year queried" },
        geography: { type: "string", description: "Geography filter applied" },
        fund_count: {
          type: "number",
          description: "Number of funds in this cell. Quartiles require ≥15.",
        },
        median_net_irr: {
          type: "number",
          description: "Median net IRR (%) across funds in this cell",
        },
        q1_threshold_irr: {
          type: "number",
          description: "Top quartile threshold IRR. Null if fund_count < 15.",
        },
        q3_threshold_irr: {
          type: "number",
          description: "Bottom quartile threshold IRR. Null if fund_count < 15.",
        },
        median_tvpi: {
          type: "number",
          description: "Median Total Value to Paid-In multiple",
        },
        median_dpi: {
          type: "number",
          description: "Median Distributions to Paid-In multiple",
        },
        as_of_date: {
          type: "string",
          description: "Most recent reporting date across sources",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Pension sources contributing to this benchmark",
        },
      },
      required: ["strategy", "vintage_year", "geography", "fund_count", "sources"],
    },
  },
  {
    name: "lookup_fund",
    description:
      "Look up a specific private fund by name. Returns performance metrics (IRR, TVPI, DPI), strategy classification, and peer quartile ranking. Searches by partial name match.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "instant",
      pricing: {
        executeUsd: "0.001",
      },
      rateLimit: {
        maxRequestsPerMinute: 60,
        cooldownMs: 1000,
        maxConcurrency: 5,
      },
    },
    inputSchema: {
      type: "object" as const,
      properties: {
        fund_name: {
          type: "string",
          description: "Fund name or partial name to search for",
          default: "Blackstone Capital Partners",
          examples: [
            "Blackstone Capital Partners",
            "Apollo Investment Fund",
            "KKR Americas",
            "Thoma Bravo",
          ],
        },
      },
      required: ["fund_name"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        fund_name: { type: "string", description: "Full fund name" },
        manager: { type: "string", description: "Fund manager name" },
        vintage_year: { type: "number", description: "Vintage year" },
        strategy: { type: "string", description: "Strategy classification" },
        net_irr: { type: "number", description: "Net IRR (%)" },
        tvpi: { type: "number", description: "Total Value to Paid-In multiple" },
        dpi: { type: "number", description: "Distributions to Paid-In multiple" },
        peer_quartile: {
          type: "number",
          description: "Quartile ranking (1=top, 4=bottom). Null if <15 peers.",
        },
        peer_fund_count: {
          type: "number",
          description: "Number of peer funds used for quartile ranking",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Data sources (e.g., calpers, oregon)",
        },
        as_of_date: { type: "string", description: "Reporting date" },
      },
      required: ["fund_name", "manager", "vintage_year", "strategy"],
    },
  },
  {
    name: "list_available_benchmarks",
    description:
      "List all strategy × vintage year combinations with ≥15 funds for statistically meaningful quartile benchmarks. Use this to discover which queries will return quartile data.",
    _meta: {
      surface: "both",
      queryEligible: true,
      latencyClass: "instant",
      pricing: {
        executeUsd: "0.001",
      },
      rateLimit: {
        maxRequestsPerMinute: 60,
        cooldownMs: 1000,
        maxConcurrency: 5,
      },
    },
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        benchmarks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              strategy: { type: "string" },
              vintage_year: { type: "number" },
              fund_count: { type: "number" },
            },
          },
          description: "Available benchmark cells with ≥15 funds",
        },
        total_funds: {
          type: "number",
          description: "Total funds in database",
        },
        data_sources: {
          type: "array",
          items: { type: "string" },
          description: "Active pension data sources",
        },
      },
      required: ["benchmarks", "total_funds", "data_sources"],
    },
  },
];

initDB();

function createMcpServer(): Server {
  const server = new Server(
    { name: "fundmark", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "get_fund_benchmarks") {
        const strategy = (args as any)?.strategy || "buyout";
        const vintageYear = (args as any)?.vintage_year || 2019;
        const geography = (args as any)?.geography || "US";

        const result = await getBenchmark(strategy, vintageYear, geography);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      }

      if (name === "lookup_fund") {
        const fundName = (args as any)?.fund_name || "Blackstone Capital Partners";

        const result = await lookupFund(fundName);
        if (!result) {
          return {
            content: [
              { type: "text", text: `No fund found matching "${fundName}".` },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      }

      if (name === "list_available_benchmarks") {
        const benchmarks = await getAvailableBenchmarks();
        const result = {
          benchmarks,
          total_funds: benchmarks.reduce(
            (sum: number, b: any) => sum + parseInt(b.fund_count),
            0
          ),
          data_sources: ["calpers", "oregon", "calstrs", "wsib", "florida"],
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Error executing ${name}: ${(err as Error).message}` },
        ],
        isError: true,
      };
    }
  });

  return server;
}

const app = express();
app.use(express.json());

//app.use("/mcp", createContextMiddleware());

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "fundmark", version: "1.0.0" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
    });
    const server = createMcpServer();
    await server.connect(transport);
  } else {
    res.status(400).json({ error: "Invalid session" });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: "Invalid session" });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`FundMark MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  startWeeklyMonitor();
});