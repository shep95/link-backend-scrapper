import type { Finding, Scan } from "@ghostchain/shared";

export function toSarif(scan: Scan, findings: Finding[]): string {
  const rules = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();
  for (const f of findings) {
    if (rules.has(f.type)) continue;
    rules.set(f.type, {
      id: f.type,
      name: f.type,
      shortDescription: { text: f.type.replace(/_/g, " ").toLowerCase() }
    });
  }

  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "GhostChain",
            informationUri: "https://github.com/shep95/link-backend-scrapper",
            version: "0.1.0",
            rules: Array.from(rules.values())
          }
        },
        results: findings.map((f) => ({
          ruleId: f.type,
          level: f.severity === "CRITICAL" || f.severity === "HIGH" ? "error" : "warning",
          message: { text: f.evidence.summary },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.url } } }],
          properties: {
            scan_id: scan.id,
            target: f.target,
            confidence: f.confidence,
            anchors: f.evidence.anchors
          }
        }))
      }
    ]
  };

  return JSON.stringify(sarif, null, 2);
}
