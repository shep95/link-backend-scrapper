import type { FullAuditReport } from "@ghostchain/shared";

export function toAuditJson(report: FullAuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function toAuditHtml(report: FullAuditReport): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const flawRows = report.file_narratives
    .filter((f) => f.flaws.length > 0)
    .map(
      (f) => `<tr>
      <td>${esc(f.path)}</td>
      <td>${f.flaws.length}</td>
      <td>${esc(f.flaws.map((x) => x.category + ":" + x.title).join("; "))}</td>
    </tr>`
    )
    .join("");

  const exploitRows = report.exploit_scenarios
    .map(
      (e) => `<tr>
      <td><span class="sev-${e.severity.toLowerCase()}">${esc(e.severity)}</span></td>
      <td>${esc(e.title)}</td>
      <td>${esc(e.takedown_risk)}</td>
      <td>${esc(e.patches.join(" · "))}</td>
    </tr>`
    )
    .join("");

  const keyRows = report.api_key_probes
    .map(
      (k) => `<tr>
      <td>${esc(k.key_type)}</td>
      <td>${esc(k.masked_key)}</td>
      <td>${esc(k.test_result)}</td>
      <td>${esc(k.source)}</td>
      <td>${esc(k.recommendation)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>GhostChain Audit Report</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0f14;color:#e6edf3;margin:0;padding:24px}
h1,h2{color:#58a6ff} table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #1f2937;padding:10px;text-align:left;vertical-align:top}
th{background:#121821}.sev-critical,.sev-high{color:#ff7b72}.sev-medium{color:#f2cc60}.sev-low{color:#7ee787}
.meta{color:#8b949e}
</style></head><body>
<h1>GhostChain Narrative Audit Report</h1>
<p class="meta">${esc(report.summary)}</p>
<h2>Flaw counts</h2>
<ul>
<li>Security: ${report.flaw_counts.security}</li>
<li>Workflow: ${report.flaw_counts.workflow}</li>
<li>Bug: ${report.flaw_counts.bug}</li>
<li>Logical: ${report.flaw_counts.logical}</li>
<li>Total: ${report.flaw_counts.total}</li>
</ul>
<h2>Exploit &amp; takedown scenarios</h2>
<table><thead><tr><th>Severity</th><th>Scenario</th><th>Takedown risk</th><th>Patches</th></tr></thead>
<tbody>${exploitRows || "<tr><td colspan='4'>None</td></tr>"}</tbody></table>
<h2>API key tests</h2>
<table><thead><tr><th>Type</th><th>Key</th><th>Result</th><th>Source</th><th>Recommendation</th></tr></thead>
<tbody>${keyRows || "<tr><td colspan='5'>No keys found</td></tr>"}</tbody></table>
<h2>Files with flaws</h2>
<table><thead><tr><th>File</th><th>Flaws</th><th>Summary</th></tr></thead>
<tbody>${flawRows || "<tr><td colspan='3'>No code flaws</td></tr>"}</tbody></table>
</body></html>`;
}
