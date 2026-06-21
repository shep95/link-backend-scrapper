import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

const DIR_LISTING_SIGS = [
  "index of /",
  "directory listing for",
  "<title>index of",
  "parent directory</a>"
];

export function auditDirListing(
  scanId: string,
  target: string,
  url: string,
  status: number,
  bodyText: string
): Finding[] {
  if (status !== 200) return [];
  const lower = bodyText.slice(0, 50_000).toLowerCase();
  const hit = DIR_LISTING_SIGS.find((s) => lower.includes(s));
  if (!hit) return [];
  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "DIR_LISTING",
      severity: "HIGH",
      confidence: 0.85,
      evidence: {
        summary: "Possible directory listing detected",
        anchors: { signature: hit, url }
      },
      created_at: nowIso()
    }
  ];
}
