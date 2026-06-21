import type { Db } from "@ghostchain/storage";
import type { Finding, ScanCreateInput } from "@ghostchain/shared";
import { toHtml, toJsonFindings, toSarif } from "@ghostchain/reporting";
import { runScan, nowIso, uid } from "@ghostchain/engine";
import {
  getScan,
  insertFindings,
  insertNotification,
  insertRequestLogs,
  insertScan,
  listFindings,
  listScans,
  updateScanStatus
} from "@ghostchain/storage";

const running = new Set<string>();

export async function enqueueScan(db: Db, input: ScanCreateInput): Promise<{ scan_id: string }> {
  const scanId = uid("scan");
  insertScan(db, {
    id: scanId,
    created_at: nowIso(),
    mode: input.mode,
    targets: input.targets,
    options: input.options,
    status: "queued"
  });

  void executeScan(db, scanId, input);
  return { scan_id: scanId };
}

async function executeScan(db: Db, scanId: string, input: ScanCreateInput): Promise<void> {
  if (running.has(scanId)) return;
  running.add(scanId);
  updateScanStatus(db, scanId, "running");

  try {
    const result = await runScan(input, scanId);
    insertFindings(db, result.findings);
    insertRequestLogs(db, result.requestLogs);
    updateScanStatus(db, scanId, result.scan.status, result.scan.error);

    for (const f of result.findings.filter((x) => x.severity === "HIGH" || x.severity === "CRITICAL")) {
      insertNotification(db, {
        id: uid("notif"),
        created_at: nowIso(),
        scan_id: scanId,
        severity: f.severity,
        title: `${f.severity}: ${f.type}`,
        body: f.evidence.summary,
        finding_id: f.id
      });
    }
  } catch (err) {
    updateScanStatus(db, scanId, "error", err instanceof Error ? err.message : String(err));
  } finally {
    running.delete(scanId);
  }
}

export function getScanBundle(db: Db, scanId: string) {
  const scan = getScan(db, scanId);
  if (!scan) return null;
  const findings = listFindings(db, scanId);
  return { scan, findings };
}

export function exportReport(db: Db, scanId: string, format: "json" | "sarif" | "html"): string | null {
  const bundle = getScanBundle(db, scanId);
  if (!bundle) return null;
  if (format === "json") return toJsonFindings(bundle.scan, bundle.findings);
  if (format === "sarif") return toSarif(bundle.scan, bundle.findings);
  return toHtml(bundle.scan, bundle.findings);
}

export { listScans, listFindings };
