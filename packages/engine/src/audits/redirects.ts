import type { Finding } from "@ghostchain/shared";
import { uid, nowIso } from "../utils.js";

const SUSPICIOUS_PARAMS = [
  "next",
  "redirect",
  "return",
  "url",
  "continue",
  "redirect_uri",
  "dest",
  "target",
  "return_url",
  "callback"
];

function isExternalRedirect(location: string, origin: string): boolean {
  try {
    const loc = new URL(location, origin);
    const base = new URL(origin);
    return loc.hostname.toLowerCase() !== base.hostname.toLowerCase();
  } catch {
    return false;
  }
}

function hasSuspiciousRedirectParam(value: string): boolean {
  try {
    const u = new URL(value);
    for (const [key] of u.searchParams) {
      if (SUSPICIOUS_PARAMS.includes(key.toLowerCase())) return true;
    }
    return false;
  } catch {
    return SUSPICIOUS_PARAMS.some((p) => value.toLowerCase().includes(`${p}=`));
  }
}

export function auditRedirectHygiene(
  scanId: string,
  target: string,
  url: string,
  headers: Record<string, string>
): Finding[] {
  const loc = headers["location"];
  if (!loc) return [];

  const external = isExternalRedirect(loc, url);
  const suspicious = hasSuspiciousRedirectParam(loc);
  if (!external && !suspicious) return [];

  return [
    {
      id: uid("finding"),
      scan_id: scanId,
      target,
      url,
      type: "REDIRECT_HYGIENE",
      severity: external ? "MEDIUM" : "LOW",
      confidence: external ? 0.85 : 0.65,
      evidence: {
        summary: external
          ? "Redirect points to an external host; review for open-redirect risk"
          : "Redirect target contains a suspicious parameter; review for open-redirect risk",
        anchors: { location: loc, url }
      },
      created_at: nowIso()
    }
  ];
}
