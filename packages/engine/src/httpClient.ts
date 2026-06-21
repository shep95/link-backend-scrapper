import { Agent, fetch } from "undici";

export type HttpClientOptions = {
  timeoutMs: number;
  maxRedirs: number;
  userAgent: string;
};

export function createHttpAgent(): Agent {
  return new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000
  });
}

export async function httpGet(
  agent: Agent,
  url: string,
  opts: HttpClientOptions
): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      dispatcher: agent,
      redirect: opts.maxRedirs > 0 ? "follow" : "manual",
      headers: {
        "user-agent": opts.userAgent,
        accept: "*/*"
      },
      signal: controller.signal
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    return { status: res.status, headers, body: buf };
  } finally {
    clearTimeout(t);
  }
}
