import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Db } from "@ghostchain/storage";
import { ScanCreateSchema } from "@ghostchain/shared";
import { checkBasicAuth } from "./auth.js";
import { ackNotification, getNotifications } from "./notifications.js";
import { enqueueScan, exportReport, getScanBundle, listScans } from "./scans.js";
import { getDashboardHtml, getStaticAsset } from "./static.js";

type Env = {
  user: string;
  pass: string;
};

const MAX_BODY_BYTES = 1_048_576;
const REPORT_FORMATS = ["json", "sarif", "html"] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(Buffer.from(c));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isReportFormat(value: string): value is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(value);
}

export function createApp(db: Db, env: Env) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      json(res, 200, { ok: true, service: "ghostchain" });
      return;
    }

    const authOk = checkBasicAuth(req.headers.authorization, env.user, env.pass);

    if (url.pathname.startsWith("/api/") && !authOk) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="GhostChain"',
        "content-type": "text/plain; charset=utf-8"
      });
      res.end("Unauthorized");
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(getDashboardHtml());
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const asset = getStaticAsset(url.pathname.replace("/assets/", ""));
      if (!asset) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": asset.contentType });
      res.end(asset.data);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/scans") {
      json(res, 200, { scans: listScans(db) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/scans") {
      try {
        const body = await readJson(req);
        const input = ScanCreateSchema.parse(body);
        const out = await enqueueScan(db, input);
        json(res, 202, out);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message === "Request body too large" ? 413 : 400;
        json(res, status, { error: message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/scans/")) {
      const parts = url.pathname.split("/");
      const scanId = parts[3];
      if (!scanId) {
        json(res, 400, { error: "missing scan id" });
        return;
      }

      if (parts.length > 4 && parts[4] !== "report") {
        json(res, 404, { error: "not found" });
        return;
      }

      if (parts[4] === "report") {
        const formatParam = url.searchParams.get("format") ?? "json";
        if (!isReportFormat(formatParam)) {
          json(res, 400, { error: "invalid format; use json, sarif, or html" });
          return;
        }
        const report = exportReport(db, scanId, formatParam);
        if (!report) {
          json(res, 404, { error: "scan not found" });
          return;
        }
        const ct =
          formatParam === "html"
            ? "text/html; charset=utf-8"
            : formatParam === "sarif"
              ? "application/sarif+json"
              : "application/json";
        res.writeHead(200, { "content-type": ct });
        res.end(report);
        return;
      }

      const bundle = getScanBundle(db, scanId);
      if (!bundle) {
        json(res, 404, { error: "scan not found" });
        return;
      }
      json(res, 200, bundle);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      json(res, 200, { notifications: getNotifications(db) });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/notifications/") && url.pathname.endsWith("/ack")) {
      const id = url.pathname.split("/")[3];
      if (!id) {
        json(res, 400, { error: "missing id" });
        return;
      }
      const ok = ackNotification(db, id, env.user);
      json(res, ok ? 200 : 404, { ok });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}
