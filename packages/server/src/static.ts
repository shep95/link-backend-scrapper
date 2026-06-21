import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "../../web/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export function getDashboardHtml(): string {
  const built = join(DIST_DIR, "index.html");
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

function isPathInsideDist(candidate: string): boolean {
  const rel = relative(DIST_DIR, candidate);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== "..";
}

export function getStaticAsset(name: string): { data: Buffer; contentType: string } | null {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) return null;

  const resolved = resolve(DIST_DIR, normalized);
  if (!isPathInsideDist(resolved)) return null;
  if (!existsSync(resolved)) return null;

  const ext = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  return { data: readFileSync(resolved), contentType };
}
