export type FlawCategory = "security" | "workflow" | "bug" | "logical";

export type CodeFlaw = {
  id: string;
  category: FlawCategory;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  line?: number;
  pattern?: string;
};

export type FileNarrative = {
  path: string;
  original_narrative: string;
  flaws: CodeFlaw[];
  revised_narrative: string;
  remediation_snippets: Array<{ flaw_id: string; description: string; suggested_code: string }>;
};

export type ExploitScenario = {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  attack_vector: string;
  takedown_risk: string;
  prerequisites: string[];
  steps: string[];
  patches: string[];
  related_flaws: string[];
  related_findings: string[];
};

export type ApiKeyProbe = {
  id: string;
  key_type: string;
  source: string;
  masked_key: string;
  format_valid: boolean;
  live_tested: boolean;
  test_result: "valid" | "invalid" | "revoked" | "restricted" | "unknown" | "dangerous_public";
  details: string;
  recommendation: string;
};

export type AuditFlawCounts = {
  security: number;
  workflow: number;
  bug: number;
  logical: number;
  total: number;
};

export type FullAuditReport = {
  id: string;
  created_at: string;
  codebase_root?: string;
  targets?: string[];
  files_audited: number;
  flaw_counts: AuditFlawCounts;
  file_narratives: FileNarrative[];
  exploit_scenarios: ExploitScenario[];
  api_key_probes: ApiKeyProbe[];
  summary: string;
};
