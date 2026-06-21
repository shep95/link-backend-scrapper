import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Finding, RequestLog, Scan, ScanCreateInput } from "@ghostchain/shared";
import { Agent } from "undici";
import {
  auditCookies,
  auditCors,
  auditDirListing,
  auditRedirectHygiene,
  auditSecrets,
  auditSecurityHeaders,
  auditSourcemaps
} from "./audits/index.js";
import { collectDns } from "./dns.js";
import { crawl } from "./crawl.js";
import { generateCandidates } from "./discover.js";
import { createHttpAgent, type HttpClientOptions } from "./httpClient.js";
import { probeHttp } from "./httpProbe.js";
import { tcpConnect } from "./portProbe.js";
import { TokenBucket } from "./rateLimit.js";
import { isHostAllowed, buildAllowHostsForTarget } from "./scope.js";
import { getTlsSans } from "./tls.js";
import { uid, nowIso } from "./utils.js";
import { runFullAudit } from "./pipeline/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ScanEngineConfig = {
  maxConcurrencyPerHost: number;
  maxRpsPerHost: number;
  maxCrawlDepth: number;
  maxUrlsPerHost: number;
  ports: number[];
  wordlist: "small" | "medium";
  userAgent: string;
};

const DEFAULT_PORTS = [80, 443, 8080, 8443, 3000, 8000];
const EXTENSIONS = [".bak", ".old", ".env", ".json", ".yaml", ".yml", ".log", ".zip"];

function loadWordlist(name: "small" | "medium"): string[] {
  const file = join(__dirname, "wordlists", `common-paths.${name}.txt`);
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeTarget(raw: string): { host: string; baseUrl: string } {
  const withScheme = raw.includes("://") ? raw : `https://${raw}`;
  const u = new URL(withScheme);
  return { host: u.hostname, baseUrl: `${u.protocol}//${u.host}/` };
}

function runAudits(
  scanId: string,
  target: string,
  probe: Awaited<ReturnType<typeof probeHttp>>
): Finding[] {
  const bodyText = new TextDecoder().decode(probe.body.slice(0, 500_000));
  return [
    ...auditSecurityHeaders(scanId, target, probe.url, probe.headers),
    ...auditCookies(scanId, target, probe.url, probe.headers),
    ...auditCors(scanId, target, probe.url, probe.headers),
    ...auditRedirectHygiene(scanId, target, probe.url, probe.headers),
    ...auditDirListing(scanId, target, probe.url, probe.status, bodyText),
    ...auditSourcemaps(scanId, target, probe.url, probe.status, probe.contentType),
    ...auditSecrets(scanId, target, probe.url, probe.status, bodyText)
  ];
}

export async function runScan(input: ScanCreateInput, scanId = uid("scan")): Promise<{
  scan: Scan;
  findings: Finding[];
  requestLogs: RequestLog[];
  meta: Record<string, unknown>;
}> {
  const cfg: ScanEngineConfig = {
    maxConcurrencyPerHost: input.options.maxConcurrencyPerHost ?? 10,
    maxRpsPerHost: input.options.maxRpsPerHost ?? 5,
    maxCrawlDepth: input.options.maxCrawlDepth ?? 3,
    maxUrlsPerHost: input.options.maxUrlsPerHost ?? 5000,
    ports: input.options.ports ?? DEFAULT_PORTS,
    wordlist: input.options.wordlist ?? "small",
    userAgent: "GhostChain/0.1 (+https://github.com/shep95/link-backend-scrapper)"
  };

  const scan: Scan = {
    id: scanId,
    created_at: nowIso(),
    mode: input.mode,
    targets: input.targets,
    options: input.options,
    status: "running"
  };

  const agent = createHttpAgent();
  const findings: Finding[] = [];
  const requestLogs: RequestLog[] = [];
  const meta: Record<string, unknown> = { hosts: {} };
  const remoteBodies: Array<{ url: string; content: string }> = [];

  try {
    for (const rawTarget of input.targets) {
      const { host, baseUrl } = normalizeTarget(rawTarget);
      const allowedHosts = buildAllowHostsForTarget(host);
      if (!isHostAllowed(host, allowedHosts)) {
        continue;
      }

      const hostMeta: Record<string, unknown> = {};
      const bucket = new TokenBucket(cfg.maxRpsPerHost, cfg.maxRpsPerHost);
      const urlsToProbe = new Set<string>([baseUrl]);
      const httpOpts: HttpClientOptions = {
        timeoutMs: 12_000,
        maxRedirs: 5,
        userAgent: cfg.userAgent,
        allowedHosts
      };

      if (input.mode === "surface" || input.mode === "full") {
        hostMeta.dns = await collectDns(host);
        const tlsResult = await getTlsSans(host);
        hostMeta.tlsSans = tlsResult.sans;
        hostMeta.tlsConnected = tlsResult.connected;
        const openPorts: number[] = [];
        for (const port of cfg.ports) {
          if (await tcpConnect(host, port)) openPorts.push(port);
        }
        hostMeta.openPorts = openPorts;

        if (openPorts.includes(443)) urlsToProbe.add(`https://${host}/`);
        if (openPorts.includes(80)) urlsToProbe.add(`http://${host}/`);

        if (tlsResult.connected && tlsResult.sans.length === 0) {
          findings.push({
            id: uid("finding"),
            scan_id: scanId,
            target: host,
            url: baseUrl,
            type: "TLS_POSTURE",
            severity: "LOW",
            confidence: 0.5,
            evidence: { summary: "TLS reachable but no DNS SANs found on certificate", anchors: { host } },
            created_at: nowIso()
          });
        }
      }

      if (input.mode === "web" || input.mode === "full") {
        const start = baseUrl;
        const crawled = await crawl(agent, start, httpOpts, {
          maxDepth: cfg.maxCrawlDepth,
          maxUrlsPerHost: cfg.maxUrlsPerHost
        });
        hostMeta.crawl = crawled;
        for (const p of crawled.pages) urlsToProbe.add(p);
        for (const a of crawled.assets) urlsToProbe.add(a);

        const candidates = generateCandidates(baseUrl, {
          wordlist: loadWordlist(cfg.wordlist),
          extensions: EXTENSIONS
        });
        for (const c of candidates.slice(0, 500)) urlsToProbe.add(c);
      }

      for (const url of urlsToProbe) {
        await bucket.take(1);
        const t0 = Date.now();
        try {
          const probe = await probeHttp(agent, url, httpOpts);
          requestLogs.push({
            scan_id: scanId,
            url,
            method: "GET",
            status: probe.status,
            bytes: probe.bytes,
            duration_ms: Date.now() - t0,
            retries: 0,
            created_at: nowIso()
          });
          if (probe.body.byteLength > 0 && probe.body.byteLength <= 1_500_000) {
            remoteBodies.push({
              url: probe.url,
              content: new TextDecoder().decode(probe.body)
            });
          }
          findings.push(...runAudits(scanId, host, probe));
        } catch {
          requestLogs.push({
            scan_id: scanId,
            url,
            method: "GET",
            status: 0,
            bytes: 0,
            duration_ms: Date.now() - t0,
            retries: 0,
            created_at: nowIso()
          });
        }
      }

      (meta.hosts as Record<string, unknown>)[host] = hostMeta;
    }

    scan.status = "done";
  } catch (err) {
    scan.status = "error";
    scan.error = err instanceof Error ? err.message : String(err);
  }

  const auditReport = await runFullAudit({
    ...(typeof input.options.auditCodebase === "string" ? { codebaseRoot: input.options.auditCodebase } : {}),
    targets: input.targets,
    remoteBodies,
    scanFindings: findings
  });
  meta.audit = auditReport;

  return { scan, findings, requestLogs, meta };
}

export * from "./utils.js";
export * from "./scope.js";
export * from "./rateLimit.js";
export * from "./httpClient.js";
export * from "./urlCanon.js";
export * from "./dns.js";
export * from "./tls.js";
export * from "./portProbe.js";
export * from "./httpProbe.js";
export * from "./crawl.js";
export * from "./discover.js";
export * from "./audits/index.js";
export * from "./pipeline/index.js";
