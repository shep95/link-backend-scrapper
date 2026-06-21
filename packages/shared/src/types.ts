export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FindingType =
  | "DIR_LISTING"
  | "EXPOSED_BACKUP"
  | "EXPOSED_LOG"
  | "EXPOSED_CONFIG"
  | "DEBUG_ENDPOINT"
  | "OPENAPI_EXPOSED"
  | "SOURCEMAP_EXPOSED"
  | "SECRET_POSSIBLE"
  | "CORS_MISCONFIG"
  | "COOKIE_MISCONFIG"
  | "SECURITY_HEADERS"
  | "REDIRECT_HYGIENE"
  | "TLS_POSTURE"
  | "INFO";

export type Evidence = {
  summary: string;
  anchors: Record<string, string>;
  sample?: string;
};

export type Finding = {
  id: string;
  scan_id: string;
  target: string;
  url: string;
  type: FindingType;
  severity: Severity;
  confidence: number;
  evidence: Evidence;
  created_at: string;
};

export type RequestLog = {
  scan_id: string;
  url: string;
  method: string;
  status: number;
  bytes: number;
  duration_ms: number;
  retries: number;
  created_at: string;
};

export type Scan = {
  id: string;
  created_at: string;
  mode: "surface" | "web" | "full";
  targets: string[];
  options: Record<string, unknown>;
  status: "queued" | "running" | "done" | "error";
  error?: string;
};

export type NotificationEvent = {
  id: string;
  created_at: string;
  scan_id: string;
  severity: Severity;
  title: string;
  body: string;
  finding_id?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
};

export type ScanResult = {
  scan: Scan;
  findings: Finding[];
  requestLogs: RequestLog[];
  meta: Record<string, unknown>;
};
