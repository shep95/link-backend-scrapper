import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getDashboardHtml(): string {
  const built = join(__dirname, "../../web/dist/index.html");
  if (existsSync(built)) return readFileSync(built, "utf8");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GhostChain</title>
  <style>
    body { font-family: system-ui,sans-serif; background:#0b0f14; color:#e6edf3; display:grid; place-items:center; min-height:100vh; margin:0; }
    .card { background:#121821; padding:32px; border-radius:16px; max-width:520px; text-align:center; }
    code { background:#1f2937; padding:2px 6px; border-radius:6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>GhostChain API</h1>
    <p>Dashboard UI not built yet. Run <code>pnpm --filter @ghostchain/web build</code> or use the REST API.</p>
    <p><code>GET /api/scans</code> · <code>POST /api/scans</code></p>
  </div>
</body>
</html>`;
}

export function getStaticAsset(name: string): Buffer | null {
  const p = join(__dirname, "../../web/dist", name);
  if (!existsSync(p)) return null;
  return readFileSync(p);
}
