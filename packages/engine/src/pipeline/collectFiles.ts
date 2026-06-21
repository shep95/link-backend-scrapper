import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".json",
  ".sql",
  ".yaml",
  ".yml",
  ".toml",
  ".md",
  ".txt"
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  ".next",
  ".turbo",
  "scan-out-aureon",
  "scan-out-aureon-web",
  "pnpm-lock.yaml"
]);

export type CollectedFile = {
  path: string;
  relative_path: string;
  content: string;
  extension: string;
};

export function collectAllCodeFiles(root: string): CollectedFile[] {
  const out: CollectedFile[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = extname(name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;
      if (st.size > 2_000_000) continue;
      try {
        const content = readFileSync(full, "utf8");
        out.push({
          path: full,
          relative_path: relative(root, full).replace(/\\/g, "/"),
          content,
          extension: ext
        });
      } catch {
        // skip binary/unreadable
      }
    }
  }

  walk(root);
  return out.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

export function collectContentSources(
  codebaseFiles: CollectedFile[],
  remoteBodies: Array<{ url: string; content: string }>
): Array<{ source: string; content: string }> {
  const sources = codebaseFiles.map((f) => ({ source: f.relative_path, content: f.content }));
  for (const b of remoteBodies) sources.push({ source: b.url, content: b.content });
  return sources;
}
