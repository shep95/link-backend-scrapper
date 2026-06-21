import type { ApiKeyProbe } from "@ghostchain/shared";
import { uid } from "../utils.js";

export type ExtractedKey = {
  key_type: string;
  raw_key: string;
  source: string;
};

const PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "aws_access_key", re: /AKIA[0-9A-Z]{16}/g },
  { type: "github_pat", re: /ghp_[A-Za-z0-9]{36,}/g },
  { type: "github_oauth", re: /gho_[A-Za-z0-9]{36,}/g },
  { type: "stripe_live", re: /sk_live_[A-Za-z0-9]{20,}/g },
  { type: "stripe_test", re: /sk_test_[A-Za-z0-9]{20,}/g },
  { type: "slack_token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: "supabase_jwt", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { type: "openai_key", re: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g },
  { type: "generic_api_key", re: /(?:api[_-]?key|apikey)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']/gi }
];

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1] ?? "", "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractApiKeys(sources: Array<{ source: string; content: string }>): ExtractedKey[] {
  const found: ExtractedKey[] = [];
  const seen = new Set<string>();

  for (const { source, content } of sources) {
    for (const { type, re } of PATTERNS) {
      re.lastIndex = 0;
      for (const m of content.matchAll(re)) {
        const raw = m[1] ?? m[0];
        const dedupe = `${type}:${raw}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        found.push({ key_type: type, raw_key: raw, source });
      }
    }
  }
  return found;
}

async function testKey(key: ExtractedKey): Promise<ApiKeyProbe> {
  const base: ApiKeyProbe = {
    id: uid("keyprobe"),
    key_type: key.key_type,
    source: key.source,
    masked_key: maskKey(key.raw_key),
    format_valid: true,
    live_tested: false,
    test_result: "unknown",
    details: "",
    recommendation: "Rotate the key and move it to environment variables."
  };

  try {
    if (key.key_type === "github_pat" || key.key_type === "github_oauth") {
      base.live_tested = true;
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${key.raw_key}`, "User-Agent": "GhostChain-Audit" },
        signal: AbortSignal.timeout(8000)
      });
      if (res.status === 200) {
        base.test_result = "valid";
        base.details = "GitHub API accepted this token — full account/API access possible.";
        base.recommendation = "Revoke immediately in GitHub settings; never commit tokens.";
      } else if (res.status === 401) {
        base.test_result = "invalid";
        base.details = "GitHub rejected the token (invalid or revoked).";
        base.recommendation = "Remove from source either way; verify no historical abuse.";
      } else {
        base.test_result = "restricted";
        base.details = `GitHub returned ${res.status}; token may be rate-limited or scoped.`;
      }
      return base;
    }

    if (key.key_type === "stripe_live" || key.key_type === "stripe_test") {
      base.live_tested = true;
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key.raw_key}` },
        signal: AbortSignal.timeout(8000)
      });
      if (res.status === 200) {
        base.test_result = "valid";
        base.details = "Stripe API accepted this secret key — billing/account access possible.";
        base.recommendation = "Roll the key in Stripe dashboard immediately.";
      } else if (res.status === 401) {
        base.test_result = "invalid";
        base.details = "Stripe rejected the secret key.";
      } else {
        base.test_result = "restricted";
        base.details = `Stripe returned ${res.status}.`;
      }
      return base;
    }

    if (key.key_type === "supabase_jwt") {
      base.live_tested = true;
      const payload = decodeJwtPayload(key.raw_key);
      const role = String(payload?.role ?? "unknown");
      const ref = String(payload?.ref ?? payload?.iss ?? "unknown");
      base.details = `JWT role=${role}, ref=${ref}`;

      if (role === "service_role") {
        base.test_result = "dangerous_public";
        base.recommendation = "Service role key must never be client-exposed; rotate in Supabase.";
        return base;
      }

      if (role === "anon") {
        const supaHost = typeof ref === "string" && ref.includes("supabase") ? ref : `${ref}.supabase.co`;
        const url = ref.includes("http") ? ref : `https://${supaHost}/rest/v1/`;
        try {
          const res = await fetch(url, {
            headers: { apikey: key.raw_key, Authorization: `Bearer ${key.raw_key}` },
            signal: AbortSignal.timeout(8000)
          });
          base.test_result = res.status === 200 || res.status === 401 ? "restricted" : "unknown";
          base.details += `; REST probe ${res.status}. Anon keys are public by design — enforce RLS.`;
          base.recommendation = "Ensure Row Level Security blocks anonymous reads/writes on all tables.";
        } catch (err) {
          base.details += `; REST probe failed: ${err instanceof Error ? err.message : String(err)}`;
          base.test_result = "restricted";
        }
        return base;
      }

      base.test_result = "unknown";
      base.details += "; Could not classify JWT role for live probe.";
      return base;
    }

    if (key.key_type === "aws_access_key") {
      base.live_tested = false;
      base.test_result = "unknown";
      base.details = "AWS access key format detected; live validation requires SigV4 (not attempted).";
      base.recommendation = "Verify key is not active in IAM; rotate if exposed.";
      return base;
    }

    base.details = "Key pattern matched; no live validator available for this type.";
    return base;
  } catch (err) {
    base.details = `Live test error: ${err instanceof Error ? err.message : String(err)}`;
    return base;
  }
}

export async function testAllApiKeys(sources: Array<{ source: string; content: string }>): Promise<ApiKeyProbe[]> {
  const keys = extractApiKeys(sources);
  const results: ApiKeyProbe[] = [];
  for (const key of keys) {
    results.push(await testKey(key));
  }
  return results;
}
