#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runScan } from "@ghostchain/engine";
import { toHtml, toJsonReport, toSarif } from "@ghostchain/reporting";
import { ScanCreateSchema } from "@ghostchain/shared";

function parseArgs(argv: string[]): { targets: string; out: string; mode: string } | null {
  let targets: string | undefined;
  let out: string | undefined;
  let mode = "full";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--targets") targets = argv[++i];
    else if (a === "--out") out = argv[++i];
    else if (a === "--mode") mode = argv[++i] ?? "full";
  }
  if (!targets || !out) return null;
  return { targets, out, mode };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("Usage: ghostchain --targets ./targets.txt --out ./out [--mode surface|web|full]");
    process.exit(1);
  }

  const targets = readFileSync(args.targets, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const input = ScanCreateSchema.parse({
    mode: args.mode ?? "full",
    targets
  });

  console.error(`[ghostchain] scanning ${targets.length} target(s) in ${input.mode} mode…`);
  const result = await runScan(input);
  mkdirSync(args.out, { recursive: true });

  writeFileSync(join(args.out, "report.json"), toJsonReport(result));
  writeFileSync(join(args.out, "report.sarif.json"), toSarif(result.scan, result.findings));
  writeFileSync(join(args.out, "report.html"), toHtml(result.scan, result.findings));

  console.error(`[ghostchain] done — ${result.findings.length} findings → ${args.out}`);
  console.log(JSON.stringify({ scan_id: result.scan.id, findings: result.findings.length, status: result.scan.status }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
