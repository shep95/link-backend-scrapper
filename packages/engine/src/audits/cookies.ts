import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

export function auditCookies(
  scanId: string,
  target: string,
  url: string,
  headers: Record<string, string>
): Finding[] {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return [];
  const cookies = setCookie.split("\n").map((c) => c.trim()).filter(Boolean);

  const findings: Finding[] = [];
  for (const c of cookies) {
    const lower = c.toLowerCase();
    const bad: string[] = [];
    if (!lower.includes("httponly")) bad.push("HttpOnly");
    if (!lower.includes("secure")) bad.push("Secure");
    if (!lower.includes("samesite")) bad.push("SameSite");

    if (bad.length > 0) {
      findings.push({
        id: uid("finding"),
        scan_id: scanId,
        target,
        url,
        type: "COOKIE_MISCONFIG",
        severity: "MEDIUM",
        confidence: 0.75,
        evidence: {
          summary: `Cookie missing attributes: ${bad.join(", ")}`,
          anchors: { cookie: c.slice(0, 200) }
        },
        created_at: nowIso()
      });
    }
  }
  return findings;
}
