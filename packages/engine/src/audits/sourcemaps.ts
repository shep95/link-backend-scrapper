import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

export function auditSourcemaps(
  scanId: string,
  target: string,
  url: string,
  status: number,
  contentType: string
): Finding[] {
  if (status !== 200) return [];
  const isMap = url.endsWith(".map") || contentType.includes("application/json");
  if (!isMap) return [];
  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "SOURCEMAP_EXPOSED",
      severity: "MEDIUM",
      confidence: 0.8,
      evidence: {
        summary: "Source map publicly accessible",
        anchors: { url, contentType }
      },
      created_at: nowIso()
    }
  ];
}
