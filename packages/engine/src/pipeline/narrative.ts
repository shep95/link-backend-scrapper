import type { CollectedFile } from "./collectFiles.js";

function countMatches(content: string, re: RegExp): number {
  return (content.match(re) || []).length;
}

function listMatches(content: string, re: RegExp, limit = 5): string[] {
  return [...content.matchAll(re)].map((m) => m[0]).slice(0, limit);
}

export function writeOriginalNarrative(file: CollectedFile): string {
  const { relative_path, content, extension } = file;
  const lines = content.split("\n").length;
  const parts: string[] = [`File: ${relative_path} (${extension}, ${lines} lines).`];

  if (/package\.json$/.test(relative_path)) {
    parts.push("Package manifest defining dependencies, scripts, and workspace metadata.");
  } else if (extension === ".html") {
    parts.push("HTML shell that mounts the client application and loads assets.");
  } else if (extension === ".css") {
    parts.push("Stylesheet defining layout, theme tokens, and component presentation.");
  } else if (/routes?\.(ts|js)$/.test(relative_path)) {
    parts.push("HTTP routing layer mapping requests to handlers, auth gates, and response helpers.");
  } else if (/auth\.(ts|js)$/.test(relative_path)) {
    parts.push("Authentication helpers validating credentials and unauthorized responses.");
  } else if (/static\.(ts|js)$/.test(relative_path)) {
    parts.push("Static asset and dashboard HTML serving from the built frontend bundle.");
  } else if (/queries?\.(ts|js)$/.test(relative_path)) {
    parts.push("Database query layer with prepared statements, serialization, and list/get operations.");
  } else if (/schemas?\.(ts|js)$/.test(relative_path)) {
    parts.push("Input validation schemas constraining scan creation and shared contracts.");
  } else if (/httpClient\.(ts|js)$/.test(relative_path)) {
    parts.push("Outbound HTTP client handling redirects, timeouts, and response buffering.");
  } else if (/crawl\.(ts|js)$/.test(relative_path)) {
    parts.push("Web crawler discovering same-host links and assets within depth/url limits.");
  } else if (/audits?\//.test(relative_path)) {
    parts.push("Security audit module analyzing HTTP responses for misconfigurations and leaks.");
  } else if (/pipeline\//.test(relative_path)) {
    parts.push("Narrative audit pipeline orchestrating flaw detection, exploit mapping, and remediation.");
  } else if (/ui\.(ts|js)$/.test(relative_path)) {
    parts.push("Dashboard UI rendering state, binding events, and calling the REST client.");
  } else if (/main\.(ts|js)$/.test(relative_path)) {
    parts.push("Entry point bootstrapping the package and starting runtime loops or servers.");
  } else {
    parts.push("Application module participating in scan orchestration, storage, or reporting.");
  }

  const imports = countMatches(content, /^import\s+/gm);
  const exports = countMatches(content, /^export\s+/gm);
  const functions = countMatches(content, /function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/g);
  const awaits = countMatches(content, /\bawait\b/g);
  const fetches = countMatches(content, /\bfetch\s*\(/g);
  const sql = countMatches(content, /db\.prepare|SELECT |INSERT |UPDATE /gi);
  const innerHtml = countMatches(content, /innerHTML/g);
  const evals = countMatches(content, /\beval\s*\(/g);

  parts.push(
    `Structure: ${imports} imports, ${exports} exports, ~${functions} functions, ${awaits} awaits, ${fetches} fetch calls.`
  );
  if (sql) parts.push(`Database access: ${sql} SQL-related operations.`);
  if (innerHtml) parts.push(`DOM rendering: ${innerHtml} innerHTML assignments (XSS surface).`);
  if (evals) parts.push(`Dynamic execution: ${evals} eval() calls.`);

  const routeHints = listMatches(content, /(?:app|router)\.(get|post|put|delete)\(|url\.pathname\s*===\s*["'`][^"'`]+/gi);
  if (routeHints.length) parts.push(`Routes detected: ${routeHints.join(", ")}.`);

  return parts.join(" ");
}

export function writeRevisedNarrative(original: string, remediations: string[]): string {
  if (remediations.length === 0) return `${original} No material flaws detected; narrative stands as-is.`;
  return `${original} Revised posture: ${remediations.join(" ")}`;
}
