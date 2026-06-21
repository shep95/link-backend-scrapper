import { canonicalizeUrl } from "./urlCanon.js";

export type DiscoveryOptions = {
  wordlist: string[];
  extensions: string[];
};

export function generateCandidates(baseUrl: string, opts: DiscoveryOptions): string[] {
  const out: string[] = [];
  for (const p of opts.wordlist) {
    const clean = p.startsWith("/") ? p : `/${p}`;
    const u = canonicalizeUrl(new URL(clean, baseUrl).toString());
    if (u) out.push(u);

    for (const ext of opts.extensions) {
      const u2 = canonicalizeUrl(new URL(`${clean}${ext}`, baseUrl).toString());
      if (u2) out.push(u2);
    }
  }
  return Array.from(new Set(out));
}
