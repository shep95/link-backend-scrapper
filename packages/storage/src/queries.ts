import type { Finding, NotificationEvent, RequestLog, Scan } from "@ghostchain/shared";
import type { Db } from "./db.js";

export function insertScan(db: Db, scan: Scan, meta?: Record<string, unknown>): void {
  db.prepare(
    `INSERT INTO scans (id, created_at, mode, targets_json, options_json, status, error, meta_json)
     VALUES (@id, @created_at, @mode, @targets_json, @options_json, @status, @error, @meta_json)`
  ).run({
    id: scan.id,
    created_at: scan.created_at,
    mode: scan.mode,
    targets_json: JSON.stringify(scan.targets),
    options_json: JSON.stringify(scan.options),
    status: scan.status,
    error: scan.error ?? null,
    meta_json: meta ? JSON.stringify(meta) : null
  });
}

export function updateScanStatus(db: Db, scanId: string, status: Scan["status"], error?: string): void {
  db.prepare(`UPDATE scans SET status = ?, error = ? WHERE id = ?`).run(status, error ?? null, scanId);
}

export function insertFindings(db: Db, findings: Finding[]): void {
  const stmt = db.prepare(
    `INSERT INTO findings (id, scan_id, target, url, type, severity, confidence, evidence_json, created_at)
     VALUES (@id, @scan_id, @target, @url, @type, @severity, @confidence, @evidence_json, @created_at)`
  );
  const tx = db.transaction((rows: Finding[]) => {
    for (const f of rows) {
      stmt.run({ ...f, evidence_json: JSON.stringify(f.evidence) });
    }
  });
  tx(findings);
}

export function insertRequestLogs(db: Db, logs: RequestLog[]): void {
  const stmt = db.prepare(
    `INSERT INTO request_logs (scan_id, url, method, status, bytes, duration_ms, retries, created_at)
     VALUES (@scan_id, @url, @method, @status, @bytes, @duration_ms, @retries, @created_at)`
  );
  const tx = db.transaction((rows: RequestLog[]) => {
    for (const l of rows) stmt.run(l);
  });
  tx(logs);
}

export function insertNotification(db: Db, n: NotificationEvent): void {
  db.prepare(
    `INSERT INTO notifications (id, created_at, scan_id, severity, title, body, finding_id, acknowledged_at, acknowledged_by)
     VALUES (@id, @created_at, @scan_id, @severity, @title, @body, @finding_id, @acknowledged_at, @acknowledged_by)`
  ).run({
    id: n.id,
    created_at: n.created_at,
    scan_id: n.scan_id,
    severity: n.severity,
    title: n.title,
    body: n.body,
    finding_id: n.finding_id ?? null,
    acknowledged_at: n.acknowledged_at ?? null,
    acknowledged_by: n.acknowledged_by ?? null
  });
}

export function listScans(db: Db, limit = 50): Scan[] {
  const rows = db
    .prepare(`SELECT * FROM scans ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(rowToScan);
}

export function getScan(db: Db, id: string): Scan | null {
  const row = db.prepare(`SELECT * FROM scans WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToScan(row) : null;
}

export function listFindings(db: Db, scanId: string): Finding[] {
  const rows = db
    .prepare(`SELECT * FROM findings WHERE scan_id = ? ORDER BY severity DESC, created_at DESC`)
    .all(scanId) as Array<Record<string, unknown>>;
  return rows.map(rowToFinding);
}

export function listNotifications(db: Db, limit = 100): NotificationEvent[] {
  const rows = db
    .prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(rowToNotification);
}

export function acknowledgeNotification(db: Db, id: string, by: string): void {
  db.prepare(`UPDATE notifications SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?`).run(
    new Date().toISOString(),
    by,
    id
  );
}

function rowToScan(row: Record<string, unknown>): Scan {
  const scan: Scan = {
    id: String(row.id),
    created_at: String(row.created_at),
    mode: row.mode as Scan["mode"],
    targets: JSON.parse(String(row.targets_json)),
    options: JSON.parse(String(row.options_json)),
    status: row.status as Scan["status"]
  };
  if (row.error) scan.error = String(row.error);
  return scan;
}

function rowToFinding(row: Record<string, unknown>): Finding {
  return {
    id: String(row.id),
    scan_id: String(row.scan_id),
    target: String(row.target),
    url: String(row.url),
    type: row.type as Finding["type"],
    severity: row.severity as Finding["severity"],
    confidence: Number(row.confidence),
    evidence: JSON.parse(String(row.evidence_json)),
    created_at: String(row.created_at)
  };
}

function rowToNotification(row: Record<string, unknown>): NotificationEvent {
  const n: NotificationEvent = {
    id: String(row.id),
    created_at: String(row.created_at),
    scan_id: String(row.scan_id),
    severity: row.severity as NotificationEvent["severity"],
    title: String(row.title),
    body: String(row.body)
  };
  if (row.finding_id) n.finding_id = String(row.finding_id);
  if (row.acknowledged_at) n.acknowledged_at = String(row.acknowledged_at);
  if (row.acknowledged_by) n.acknowledged_by = String(row.acknowledged_by);
  return n;
}
