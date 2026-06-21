import type { Db } from "./db.js";

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      targets_json TEXT NOT NULL,
      options_json TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      meta_json TEXT
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      method TEXT NOT NULL,
      status INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      retries INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      finding_id TEXT,
      acknowledged_at TEXT,
      acknowledged_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
    CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
    CREATE INDEX IF NOT EXISTS idx_notifications_scan ON notifications(scan_id);
  `);
}
