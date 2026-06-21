import { Agent, fetch } from "undici";
import { isHostAllowed } from "./scope.js";

export type HttpClientOptions = {
  timeoutMs: number;
  maxRedirs: number;
  userAgent: string;
  maxBodyBytes?: number;
  allowedHosts?: string[];
};

const DEFAULT_MAX_BODY = 5_242_880; // 5 MB

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

export function createHttpAgent(): Agent {
  return new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000
  });
}

async function readBodyWithLimit(res: FetchResponse, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Response body too large");
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function collectHeaders(res: FetchResponse): Record<string, string> {
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    const key = k.toLowerCase();
    if (key === "set-cookie") {
      headers[key] = headers[key] ? `${headers[key]}\n${v}` : v;
    } else {
      headers[key] = v;
    }
  });
  return headers;
}

export async function httpGet(
  agent: Agent,
  url: string,
  opts: HttpClientOptions
): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array; finalUrl: string }> {
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  let current = url;
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const res = await fetch(current, {
        method: "GET",
        dispatcher: agent,
        redirect: "manual",
        headers: {
          "user-agent": opts.userAgent,
          accept: "*/*"
        },
        signal: controller.signal
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          const body = await readBodyWithLimit(res, maxBody);
          return { status: res.status, headers: collectHeaders(res), body, finalUrl: current };
        }
        if (opts.maxRedirs <= 0 || redirects >= opts.maxRedirs) {
          throw new Error("Too many redirects");
        }
        const next = new URL(location, current).toString();
        if (opts.allowedHosts) {
          const nextHost = new URL(next).hostname;
          if (!isHostAllowed(nextHost, opts.allowedHosts)) {
            throw new Error("Redirect out of scope");
          }
        }
        current = next;
        redirects++;
        continue;
      }

      const body = await readBodyWithLimit(res, maxBody);
      return { status: res.status, headers: collectHeaders(res), body, finalUrl: current };
    } finally {
      clearTimeout(t);
    }
  }
}
