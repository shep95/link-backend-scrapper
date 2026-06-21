import type { CodeFlaw, FlawCategory } from "@ghostchain/shared";
import type { CollectedFile } from "./collectFiles.js";
import { uid } from "../utils.js";

type Rule = {
  id: string;
  category: FlawCategory;
  severity: CodeFlaw["severity"];
  title: string;
  description: string;
  pattern: RegExp;
  remediation: string;
  suggested_code?: string;
};

const RULES: Rule[] = [
  {
    id: "sec-eval",
    category: "security",
    severity: "CRITICAL",
    title: "Dynamic code execution via eval",
    description: "eval() executes arbitrary strings and enables full compromise if input is attacker-controlled.",
    pattern: /\beval\s*\(/,
    remediation: "Remove eval; parse JSON with JSON.parse and validate with a schema.",
    suggested_code: "const data = MySchema.parse(JSON.parse(raw));"
  },
  {
    id: "sec-innerhtml",
    category: "security",
    severity: "HIGH",
    title: "innerHTML with potential XSS",
    description: "Assigning innerHTML with untrusted data enables stored/reflected XSS in the dashboard.",
    pattern: /\.innerHTML\s*=/,
    remediation: "Use textContent, DOM APIs, or escape all attribute contexts before innerHTML.",
    suggested_code: "el.textContent = value; // or use a trusted sanitizer"
  },
  {
    id: "sec-path-join-static",
    category: "security",
    severity: "CRITICAL",
    title: "Path traversal in static file serving",
    description: "join(dist, userInput) without canonicalization allows reading files outside the intended directory.",
    pattern: /join\([^)]*dist[^)]*,\s*(?:name|asset|path|req)/i,
    remediation: "Resolve path, reject .. segments, and verify the result stays inside the dist root.",
    suggested_code: "const resolved = resolve(DIST, name); if (!isInside(DIST, resolved)) return null;"
  },
  {
    id: "sec-no-body-limit",
    category: "security",
    severity: "HIGH",
    title: "Unbounded request body read",
    description: "Reading the full request body without a size cap enables memory exhaustion DoS.",
    pattern: /for\s+await\s*\([^)]*of\s+req\)|readJson|Buffer\.concat\(chunks\)/,
    remediation: "Enforce MAX_BODY_BYTES and return 413 when exceeded.",
    suggested_code: "if (total > MAX_BODY_BYTES) throw new Error('Request body too large');"
  },
  {
    id: "sec-default-creds",
    category: "security",
    severity: "HIGH",
    title: "Default credentials fallback",
    description: "Hardcoded or default admin credentials are used when environment variables are unset.",
    pattern: /DASHBOARD_USER.*\?\?\s*["']admin|DASHBOARD_PASS.*\?\?\s*["']change_me/,
    remediation: "Refuse startup unless strong credentials are configured in production.",
    suggested_code: "if (!process.env.DASHBOARD_PASS) throw new Error('DASHBOARD_PASS required');"
  },
  {
    id: "sec-no-auth-api",
    category: "security",
    severity: "MEDIUM",
    title: "API route without explicit auth check nearby",
    description: "HTTP handlers may expose data if not consistently gated behind authentication.",
    pattern: /createServer|IncomingMessage/,
    remediation: "Require auth for all /api/* routes except /api/health; return 401 early.",
    suggested_code: "if (url.pathname.startsWith('/api/') && !authOk) return unauthorized(res);"
  },
  {
    id: "sec-json-parse-unsafe",
    category: "security",
    severity: "MEDIUM",
    title: "Unsafe JSON.parse on persisted data",
    description: "Corrupt or tampered DB JSON can crash handlers or cause denial of service.",
    pattern: /JSON\.parse\(String\(row\./,
    remediation: "Wrap JSON.parse in try/catch with safe fallbacks.",
    suggested_code: "function safeJsonParse<T>(raw: string, fallback: T): T { try { return JSON.parse(raw); } catch { return fallback; } }"
  },
  {
    id: "sec-unbounded-scan",
    category: "security",
    severity: "HIGH",
    title: "Unbounded concurrent scan execution",
    description: "Fire-and-forget scans without a global limit enable resource exhaustion and outbound abuse.",
    pattern: /void\s+executeScan|enqueueScan/,
    remediation: "Use a semaphore limiting concurrent scans and queue overflow behavior.",
    suggested_code: "const MAX_CONCURRENT_SCANS = 3; await acquireScanSlot();"
  },
  {
    id: "sec-ssrf-target",
    category: "security",
    severity: "HIGH",
    title: "Scan targets not restricted to public hosts",
    description: "Accepting private/reserved targets enables SSRF against internal infrastructure.",
    pattern: /targets:\s*z\.array\(z\.string/,
    remediation: "Validate targets block localhost, RFC1918, and link-local addresses.",
    suggested_code: ".refine(isValidScanTarget, 'Target must be a public http(s) host')"
  },
  {
    id: "sec-redirect-follow",
    category: "security",
    severity: "HIGH",
    title: "Redirects followed without scope check",
    description: "Following cross-host redirects can escape intended scan scope (SSRF chain).",
    pattern: /redirect:\s*["']follow["']/,
    remediation: "Use manual redirect handling with host allowlist and max redirect count.",
    suggested_code: "redirect: 'manual' // validate each Location host against allowedHosts"
  },
  {
    id: "sec-dangerous-href",
    category: "security",
    severity: "MEDIUM",
    title: "Unvalidated URL in HTML href",
    description: "javascript: or data: URLs in href attributes enable XSS when reports are opened in browsers.",
    pattern: /<a\s+href=\$\{/,
    remediation: "Allow only http/https schemes before emitting links.",
    suggested_code: "function safeHref(url: string): string | null { const u = new URL(url); return ['http:','https:'].includes(u.protocol) ? esc(url) : null; }"
  },
  {
    id: "sec-hardcoded-secret",
    category: "security",
    severity: "CRITICAL",
    title: "Hardcoded secret or API key pattern",
    description: "Secrets committed to source can be extracted by anyone with repo or bundle access.",
    pattern: /(sk_live_|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|service_role|SUPABASE_SERVICE)/,
    remediation: "Move secrets to environment variables or a secret manager; rotate exposed keys.",
    suggested_code: "const key = process.env.STRIPE_SECRET_KEY;"
  },
  {
    id: "wf-fire-forget",
    category: "workflow",
    severity: "MEDIUM",
    title: "Fire-and-forget async without error surfacing",
    description: "Background tasks that swallow errors leave scans stuck or silently failing.",
    pattern: /void\s+\w+\(|\.catch\(\(\)\s*=>\s*\{\s*\}\)/,
    remediation: "Track background job status in storage and log structured errors.",
    suggested_code: "executeScan(db, id, input).catch(err => log.error({ scanId: id, err }));"
  },
  {
    id: "wf-no-graceful-shutdown",
    category: "workflow",
    severity: "MEDIUM",
    title: "No graceful shutdown handler",
    description: "Server restart can interrupt in-flight scans and corrupt partial writes.",
    pattern: /app\.listen\(|server\.listen\(/,
    remediation: "Handle SIGINT/SIGTERM and close the HTTP server cleanly.",
    suggested_code: "process.on('SIGTERM', () => server.close(() => process.exit(0)));"
  },
  {
    id: "wf-health-auth",
    category: "workflow",
    severity: "LOW",
    title: "Health endpoint behind authentication",
    description: "Load balancers and orchestrators cannot probe health without credentials.",
    pattern: /\/api\/health/,
    remediation: "Expose /api/health before the auth gate.",
    suggested_code: "if (url.pathname === '/api/health') return json(res, 200, { ok: true });"
  },
  {
    id: "wf-ack-noop",
    category: "workflow",
    severity: "LOW",
    title: "Notification ack always succeeds",
    description: "API returns ok:true even when the notification id does not exist.",
    pattern: /ackNotification.*return\s+true/,
    remediation: "Return false or 404 when no row was updated.",
    suggested_code: "return result.changes > 0;"
  },
  {
    id: "wf-poll-no-debounce",
    category: "workflow",
    severity: "LOW",
    title: "Polling without in-flight guard",
    description: "Overlapping refresh calls can race and waste bandwidth.",
    pattern: /setInterval\([^)]*refresh/,
    remediation: "Debounce refresh and pause polling when the document is hidden.",
    suggested_code: "if (refreshInFlight) return; document.addEventListener('visibilitychange', ...);"
  },
  {
    id: "bug-redirect-audit",
    category: "bug",
    severity: "MEDIUM",
    title: "Redirect audit inspects request URL not Location",
    description: "Open redirect detection misses real redirects when only the Location header is suspicious.",
    pattern: /url\.includes\(`\$\{p\}=\`\)/,
    remediation: "Parse and analyze the Location header value for external hosts and suspicious params.",
    suggested_code: "const suspicious = hasSuspiciousRedirectParam(loc);"
  },
  {
    id: "bug-sourcemap-json",
    category: "bug",
    severity: "MEDIUM",
    title: "Sourcemap false positive on application/json",
    description: "Treating all JSON responses as source maps floods false findings on API endpoints.",
    pattern: /contentType\.includes\(["']application\/json["']\)/,
    remediation: "Require .map in the URL path in addition to JSON content-type.",
    suggested_code: "const isMap = url.endsWith('.map') || (/\\.map($|\\?)/i.test(url) && contentType.includes('application/json'));"
  },
  {
    id: "bug-tls-empty-sans",
    category: "bug",
    severity: "LOW",
    title: "TLS unreachable reported as empty SANs",
    description: "TLS errors return empty arrays indistinguishable from valid empty certificate SANs.",
    pattern: /getTlsSans|tlsSans/,
    remediation: "Return { connected: boolean, sans: string[] } and only report when connected && sans.length === 0.",
    suggested_code: "if (tlsResult.connected && tlsResult.sans.length === 0) { /* report */ }"
  },
  {
    id: "bug-severity-sort",
    category: "bug",
    severity: "LOW",
    title: "Lexicographic severity ordering",
    description: "ORDER BY severity DESC sorts LOW above HIGH alphabetically.",
    pattern: /ORDER BY severity DESC/,
    remediation: "Use CASE expression for semantic severity ordering.",
    suggested_code: "ORDER BY CASE severity WHEN 'CRITICAL' THEN 4 ... END DESC"
  },
  {
    id: "bug-crawl-no-catch",
    category: "bug",
    severity: "MEDIUM",
    title: "Crawler aborts on single fetch failure",
    description: "An unhandled httpGet throw stops the entire crawl instead of skipping the URL.",
    pattern: /await httpGet\(agent,\s*canon/,
    remediation: "Wrap per-URL fetch in try/catch and continue the queue.",
    suggested_code: "try { res = await httpGet(...); } catch { continue; }"
  },
  {
    id: "logic-unused-concurrency",
    category: "logical",
    severity: "LOW",
    title: "maxConcurrencyPerHost configured but unused",
    description: "Configuration suggests per-host parallelism but probes run sequentially.",
    pattern: /maxConcurrencyPerHost/,
    remediation: "Implement a per-host worker pool or remove the unused option from schema.",
    suggested_code: "const pool = new HostPool(cfg.maxConcurrencyPerHost);"
  },
  {
    id: "logic-scope-noop",
    category: "logical",
    severity: "MEDIUM",
    title: "Scope allowlist always includes target host",
    description: "Building allowlist from the target itself makes scope checks a no-op.",
    pattern: /isHostAllowed\(host,\s*\[host/,
    remediation: "Use explicit allowlist from user config; validate private IPs at schema layer.",
    suggested_code: "buildAllowHostsForTarget(host) // plus isValidScanTarget at input"
  },
  {
    id: "logic-spa-200",
    category: "logical",
    severity: "MEDIUM",
    title: "SPA 200 responses inflate sensitive path findings",
    description: "Wordlist hits against SPA catch-all routes produce false HIGH findings.",
    pattern: /DEBUG_ENDPOINT|PATH_HINTS/,
    remediation: "Require distinct response body hash/size vs homepage before flagging sensitive paths.",
    suggested_code: "if (probe.bytes === baselineBytes) return []; // same SPA shell"
  },
  {
    id: "logic-evidence-optional",
    category: "logical",
    severity: "LOW",
    title: "Assumes evidence.summary always exists",
    description: "Rendering f.evidence.summary without optional chaining crashes on malformed API data.",
    pattern: /evidence\.summary/,
    remediation: "Use optional chaining and fallbacks in UI rendering.",
    suggested_code: "esc(f.evidence?.summary ?? '')"
  }
];

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export function analyzeFlaws(file: CollectedFile): Array<CodeFlaw & { remediation: string; suggested_code?: string }> {
  const flaws: Array<CodeFlaw & { remediation: string; suggested_code?: string }> = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (!rule.pattern.test(file.content)) continue;
    const key = `${file.relative_path}:${rule.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const match = rule.pattern.exec(file.content);
    const line = match?.index !== undefined ? lineNumber(file.content, match.index) : undefined;

    flaws.push({
      id: uid("flaw"),
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      ...(line !== undefined ? { line } : {}),
      pattern: rule.id,
      remediation: rule.remediation,
      ...(rule.suggested_code ? { suggested_code: rule.suggested_code } : {})
    });
    rule.pattern.lastIndex = 0;
  }

  return flaws;
}

export function countFlaws(
  all: Array<{ category: FlawCategory }>
): { security: number; workflow: number; bug: number; logical: number; total: number } {
  const counts = { security: 0, workflow: 0, bug: 0, logical: 0, total: 0 };
  for (const f of all) {
    counts[f.category]++;
    counts.total++;
  }
  return counts;
}
