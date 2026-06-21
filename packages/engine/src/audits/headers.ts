import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

export function auditSecurityHeaders(
  scanId: string,
  target: string,
  url: string,
  headers: Record<string, string>
): Finding[] {
  const needed = ["content-security-policy", "strict-transport-security", "x-frame-options", "referrer-policy"];
  const missing = needed.filter((h) => !headers[h]);
  if (missing.length === 0) return [];
  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "SECURITY_HEADERS",
      severity: missing.includes("content-security-policy") ? "MEDIUM" : "LOW",
      confidence: 0.9,
      evidence: {
        summary: `Missing security headers: ${missing.join(", ")}`,
        anchors: Object.fromEntries(missing.map((m) => [m, "missing"]))
      },
      created_at: nowIso()
    }
  ];
}
