import type { Finding, FindingType } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

const SECRET_PATTERNS: Array<{ re: RegExp; type: FindingType; severity: Finding["severity"] }> = [
  { re: /AKIA[0-9A-Z]{16}/, type: "SECRET_POSSIBLE", severity: "CRITICAL" },
  { re: /ghp_[A-Za-z0-9]{20,}/, type: "SECRET_POSSIBLE", severity: "CRITICAL" },
  { re: /sk_live_[A-Za-z0-9]{20,}/, type: "SECRET_POSSIBLE", severity: "CRITICAL" },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, type: "SECRET_POSSIBLE", severity: "CRITICAL" },
  { re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, type: "SECRET_POSSIBLE", severity: "CRITICAL" }
];

const PATH_HINTS: Array<{ re: RegExp; type: FindingType }> = [
  { re: /\.(bak|backup|old|swp)$/i, type: "EXPOSED_BACKUP" },
  { re: /\.(log|logs)$/i, type: "EXPOSED_LOG" },
  { re: /\.(env|config|ini|yaml|yml|toml)$/i, type: "EXPOSED_CONFIG" },
  { re: /\/swagger|\/openapi|\/api-docs/i, type: "OPENAPI_EXPOSED" },
  { re: /\/debug|\/actuator|\/\.env/i, type: "DEBUG_ENDPOINT" }
];

export function auditSecrets(
  scanId: string,
  target: string,
  url: string,
  status: number,
  bodyText: string
): Finding[] {
  if (status < 200 || status >= 400) return [];
  const findings: Finding[] = [];
  const sample = bodyText.slice(0, 100_000);

  for (const { re, type, severity } of SECRET_PATTERNS) {
    const m = sample.match(re);
    if (!m) continue;
    findings.push({
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type,
      severity,
      confidence: 0.7,
      evidence: {
        summary: "Possible secret material detected in response body",
        anchors: { pattern: re.source },
        sample: m[0].slice(0, 12) + "…"
      },
      created_at: nowIso()
    });
  }

  for (const { re, type } of PATH_HINTS) {
    if (!re.test(url)) continue;
    findings.push({
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type,
      severity: type === "DEBUG_ENDPOINT" ? "HIGH" : "MEDIUM",
      confidence: 0.65,
      evidence: {
        summary: `Sensitive path pattern matched: ${type}`,
        anchors: { url }
      },
      created_at: nowIso()
    });
  }

  return findings;
}
