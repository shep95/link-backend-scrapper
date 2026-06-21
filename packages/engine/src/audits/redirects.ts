import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

export function auditRedirectHygiene(
  scanId: string,
  target: string,
  url: string,
  headers: Record<string, string>
): Finding[] {
  const loc = headers["location"];
  if (!loc) return [];
  const suspiciousParams = ["next", "redirect", "return", "url", "continue"];
  const has = suspiciousParams.some((p) => url.includes(`${p}=`));
  if (!has) return [];
  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "REDIRECT_HYGIENE",
      severity: "LOW",
      confidence: 0.6,
      evidence: {
        summary: "Redirect parameter detected; review for open-redirect risk",
        anchors: { location: loc, url }
      },
      created_at: nowIso()
    }
  ];
}
