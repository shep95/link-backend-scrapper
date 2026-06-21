#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runScan, runFullAudit } from "@ghostchain/engine";
import { toHtml, toJsonReport, toSarif, toAuditJson, toAuditHtml } from "@ghostchain/reporting";
import { ScanCreateSchema } from "@ghostchain/shared";

type CliArgs = {
  targets?: string;
  out: string;
  mode: string;
  auditCodebase?: string;
  auditOnly: boolean;
};

function parseArgs(argv: string[]): CliArgs | null {
  let targets: string | undefined;
  let out: string | undefined;
  let mode = "surface";
  let auditCodebase: string | undefined;
  let auditOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--targets") targets = argv[++i];
    else if (a === "--out") out = argv[++i];
    else if (a === "--mode") mode = argv[++i] ?? "surface";
    else if (a === "--audit-codebase") auditCodebase = argv[++i];
    else if (a === "--audit-only") auditOnly = true;
  }

  if (!out) return null;
  if (!auditOnly && !targets) return null;
  return {
    out,
    mode,
    auditOnly,
    ...(targets ? { targets } : {}),
    ...(auditCodebase ? { auditCodebase } : {})
  };
}

function printUsage(): void {
  console.error(`Usage:
  ghostchain --targets ./targets.txt --out ./out [--mode surface|web|full] [--audit-codebase ./path]
  ghostchain --audit-only --audit-codebase ./path --out ./out`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exit(1);
  }

  mkdirSync(args.out, { recursive: true });
  const codebaseRoot = args.auditCodebase ? resolve(args.auditCodebase) : undefined;

  if (args.auditOnly) {
    if (!codebaseRoot) {
      console.error("--audit-only requires --audit-codebase <path>");
      process.exit(1);
    }
    console.error(`[ghostchain] narrative audit of ${codebaseRoot}…`);
    const audit = await runFullAudit({ codebaseRoot });
    writeAuditOutputs(args.out, audit);
    printAuditSummary(audit);
    return;
  }

  const targets = readFileSync(args.targets!, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const input = ScanCreateSchema.parse({
    mode: args.mode ?? "surface",
    targets,
    options: codebaseRoot ? { auditCodebase: codebaseRoot } : {}
  });

  console.error(`[ghostchain] scanning ${targets.length} target(s) in ${input.mode} mode…`);
  const result = await runScan(input);
  writeFileSync(join(args.out, "report.json"), toJsonReport(result));
  writeFileSync(join(args.out, "report.sarif.json"), toSarif(result.scan, result.findings));
  writeFileSync(join(args.out, "report.html"), toHtml(result.scan, result.findings));

  const audit = result.meta.audit as Awaited<ReturnType<typeof runFullAudit>>;
  if (audit) writeAuditOutputs(args.out, audit);

  console.error(`[ghostchain] done — ${result.findings.length} findings → ${args.out}`);
  if (audit) printAuditSummary(audit);

  console.log(
    JSON.stringify({
      scan_id: result.scan.id,
      findings: result.findings.length,
      status: result.scan.status,
      audit: audit
        ? {
            flaw_counts: audit.flaw_counts,
            api_keys_tested: audit.api_key_probes.length,
            exploit_scenarios: audit.exploit_scenarios.length
          }
        : null
    })
  );
}

function writeAuditOutputs(outDir: string, audit: Awaited<ReturnType<typeof runFullAudit>>): void {
  writeFileSync(join(outDir, "audit-report.json"), toAuditJson(audit));
  writeFileSync(join(outDir, "audit-report.html"), toAuditHtml(audit));
}

function printAuditSummary(audit: Awaited<ReturnType<typeof runFullAudit>>): void {
  console.error(`[ghostchain] audit: ${audit.summary}`);
  console.error(
    `[ghostchain] flaws — security:${audit.flaw_counts.security} workflow:${audit.flaw_counts.workflow} bug:${audit.flaw_counts.bug} logical:${audit.flaw_counts.logical}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
