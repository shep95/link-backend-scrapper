import type { FileNarrative, FullAuditReport } from "@ghostchain/shared";
import type { Finding } from "@ghostchain/shared";
import { collectAllCodeFiles, collectContentSources, type CollectedFile } from "./collectFiles.js";
import { writeOriginalNarrative, writeRevisedNarrative } from "./narrative.js";
import { analyzeFlaws, countFlaws } from "./flawAnalyzer.js";
import { testAllApiKeys } from "./apiKeyTester.js";
import { buildExploitMap } from "./exploitMap.js";
import { nowIso, uid } from "../utils.js";

export type RunFullAuditOptions = {
  codebaseRoot?: string;
  targets?: string[];
  remoteBodies?: Array<{ url: string; content: string }>;
  scanFindings?: Finding[];
};

function auditFile(file: CollectedFile): FileNarrative {
  const original = writeOriginalNarrative(file);
  const rawFlaws = analyzeFlaws(file);
  const flaws = rawFlaws.map(({ remediation: _r, suggested_code: _s, ...f }) => f);
  const remediations = rawFlaws.map((f) => f.remediation);
  const revised = writeRevisedNarrative(original, remediations);

  return {
    path: file.relative_path,
    original_narrative: original,
    flaws,
    revised_narrative: revised,
    remediation_snippets: rawFlaws
      .filter((f) => f.suggested_code)
      .map((f) => ({
        flaw_id: f.id,
        description: f.remediation,
        suggested_code: f.suggested_code!
      }))
  };
}

export async function runFullAudit(opts: RunFullAuditOptions): Promise<FullAuditReport> {
  const files = opts.codebaseRoot ? collectAllCodeFiles(opts.codebaseRoot) : [];
  const fileNarratives = files.map(auditFile);
  const allFlaws = fileNarratives.flatMap((f) => f.flaws);

  const contentSources = collectContentSources(
    files,
    (opts.remoteBodies ?? []).map((b) => ({ url: b.url, content: b.content }))
  );

  const apiKeyProbes = await testAllApiKeys(contentSources);
  const exploitScenarios = buildExploitMap(opts.scanFindings ?? [], allFlaws, apiKeyProbes);
  const flaw_counts = countFlaws(allFlaws);

  const summary = [
    `Audited ${files.length} code files`,
    opts.targets?.length ? `and ${opts.targets.length} remote target(s)` : "",
    `— ${flaw_counts.total} flaws (${flaw_counts.security} security, ${flaw_counts.workflow} workflow, ${flaw_counts.bug} bug, ${flaw_counts.logical} logical)`,
    `— ${apiKeyProbes.length} API key(s) tested`,
    `— ${exploitScenarios.length} exploit scenario(s) mapped`
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: uid("audit"),
    created_at: nowIso(),
    ...(opts.codebaseRoot ? { codebase_root: opts.codebaseRoot } : {}),
    ...(opts.targets ? { targets: opts.targets } : {}),
    files_audited: files.length,
    flaw_counts,
    file_narratives: fileNarratives,
    exploit_scenarios: exploitScenarios,
    api_key_probes: apiKeyProbes,
    summary
  };
}
