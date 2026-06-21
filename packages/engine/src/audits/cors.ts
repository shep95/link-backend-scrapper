import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

export function auditCors(
  scanId: string,
  target: string,
  url: string,
  headers: Record<string, string>
): Finding[] {
  const aco = headers["access-control-allow-origin"];
  const acc = headers["access-control-allow-credentials"];
  if (!aco) return [];
  const risky = aco.trim() === "*" && acc?.toLowerCase().trim() === "true";
  if (!risky) return [];
  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "CORS_MISCONFIG",
      severity: "HIGH",
      confidence: 0.95,
      evidence: {
        summary: "CORS allows '*' with credentials=true",
        anchors: {
          "access-control-allow-origin": aco,
          "access-control-allow-credentials": acc ?? ""
        }
      },
      created_at: nowIso()
    }
  ];
}
