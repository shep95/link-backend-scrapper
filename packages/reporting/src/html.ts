import type { Finding, Scan } from "@ghostchain/shared";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return esc(url);
    return null;
  } catch {
    return null;
  }
}

export function toHtml(scan: Scan, findings: Finding[]): string {
  const rows = findings
    .map((f) => {
      const href = safeHref(f.url);
      const urlCell = href
        ? `<a href="${href}" rel="noopener noreferrer">${esc(f.url)}</a>`
        : esc(f.url);
      return `<tr>
        <td><span class="sev sev-${f.severity.toLowerCase()}">${esc(f.severity)}</span></td>
        <td>${esc(f.type)}</td>
        <td>${urlCell}</td>
        <td>${esc(f.evidence.summary)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GhostChain Report — ${esc(scan.id)}</title>
  <style>
    :root { color-scheme: dark; --bg:#0b0f14; --panel:#121821; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; }
    body { margin:0; font:14px/1.5 system-ui,Segoe UI,sans-serif; background:var(--bg); color:var(--text); }
    header { padding:24px 32px; border-bottom:1px solid #1f2937; background:linear-gradient(135deg,#0b0f14,#111827); }
    h1 { margin:0 0 8px; font-size:24px; }
    .meta { color:var(--muted); }
    main { padding:24px 32px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:12px; overflow:hidden; }
    th, td { padding:12px 14px; border-bottom:1px solid #1f2937; text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    a { color:var(--accent); text-decoration:none; }
    .sev { padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
    .sev-critical,.sev-high { background:#3f1219; color:#ff7b72; }
    .sev-medium { background:#3a2f14; color:#f2cc60; }
    .sev-low { background:#12261a; color:#7ee787; }
  </style>
</head>
<body>
  <header>
    <h1>GhostChain Exposure Report</h1>
    <div class="meta">Scan ${esc(scan.id)} · ${esc(scan.mode)} · ${esc(scan.status)} · ${findings.length} findings</div>
  </header>
  <main>
    <table>
      <thead><tr><th>Severity</th><th>Type</th><th>URL</th><th>Summary</th></tr></thead>
      <tbody>${rows || "<tr><td colspan='4'>No findings</td></tr>"}</tbody>
    </table>
  </main>
</body>
</html>`;
}
