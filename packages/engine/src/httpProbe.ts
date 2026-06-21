import { Agent } from "undici";
import { httpGet, type HttpClientOptions } from "./httpClient.js";

export async function probeHttp(
  agent: Agent,
  url: string,
  opts: HttpClientOptions
): Promise<{
  url: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  title?: string;
  bytes: number;
  body: Uint8Array;
}> {
  const res = await httpGet(agent, url, opts);
  const contentType = res.headers["content-type"] ?? "";
  let title: string | undefined;
  if (contentType.includes("text/html")) {
    const text = new TextDecoder().decode(res.body.slice(0, 200_000));
    const m = text.match(/<title[^>]*>([^<]{0,200})<\/title>/i);
    if (m?.[1]) title = m[1].trim();
  }
  return {
    url: res.finalUrl,
    status: res.status,
    headers: res.headers,
    contentType,
    bytes: res.body.byteLength,
    body: res.body,
    ...(title ? { title } : {})
  };
}
