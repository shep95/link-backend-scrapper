import type { Finding, Scan, ScanResult } from "@ghostchain/shared";

export function toJsonReport(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function toJsonFindings(scan: Scan, findings: Finding[]): string {
  return JSON.stringify({ scan, findings, generated_at: new Date().toISOString() }, null, 2);
}
