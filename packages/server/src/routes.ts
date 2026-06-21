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

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createApp(db: Db, env: Env) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
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
      res.writeHead(200);
      res.end(asset);
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
        json(res, 400, { error: err instanceof Error ? err.message : String(err) });
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

      if (parts[4] === "report") {
        const format = (url.searchParams.get("format") ?? "json") as "json" | "sarif" | "html";
        const report = exportReport(db, scanId, format);
        if (!report) {
          json(res, 404, { error: "scan not found" });
          return;
        }
        const ct =
          format === "html" ? "text/html; charset=utf-8" : format === "sarif" ? "application/sarif+json" : "application/json";
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
      ackNotification(db, id, env.user);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      json(res, 200, { ok: true, service: "ghostchain" });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}
