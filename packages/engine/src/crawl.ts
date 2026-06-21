import * as cheerio from "cheerio";
import { Agent } from "undici";
import { httpGet, type HttpClientOptions } from "./httpClient.js";
import { canonicalizeUrl, sameHost } from "./urlCanon.js";

export type CrawlOptions = {
  maxDepth: number;
  maxUrlsPerHost: number;
};

export async function crawl(
  agent: Agent,
  startUrl: string,
  httpOpts: HttpClientOptions,
  opts: CrawlOptions
): Promise<{ pages: string[]; assets: string[] }> {
  const seen = new Set<string>();
  const pages: string[] = [];
  const assets: string[] = [];
  const q: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  while (q.length > 0) {
    const cur = q.shift();
    if (!cur) break;
    if (cur.depth > opts.maxDepth) continue;

    const canon = canonicalizeUrl(cur.url);
    if (!canon) continue;
    if (seen.has(canon)) continue;
    if (!sameHost(canon, startUrl)) continue;
    if (seen.size >= opts.maxUrlsPerHost) break;

    seen.add(canon);

    let res: Awaited<ReturnType<typeof httpGet>>;
    try {
      res = await httpGet(agent, canon, httpOpts);
    } catch {
      continue;
    }

    const ct = res.headers["content-type"] ?? "";
    if (!ct.includes("text/html")) continue;

    pages.push(canon);

    const html = new TextDecoder().decode(res.body.slice(0, 2_000_000));
    const $ = cheerio.load(html);

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      links.push(String($(el).attr("href")));
    });
    $("script[src]").each((_, el) => {
      links.push(String($(el).attr("src")));
    });
    $("link[href]").each((_, el) => {
      links.push(String($(el).attr("href")));
    });
    $("form[action]").each((_, el) => {
      links.push(String($(el).attr("action")));
    });
    $("img[src]").each((_, el) => {
      links.push(String($(el).attr("src")));
    });

    for (const raw of links) {
      if (!raw) continue;
      let abs: string;
      try {
        abs = new URL(raw, canon).toString();
      } catch {
        continue;
      }
      const c = canonicalizeUrl(abs);
      if (!c) continue;
      if (!sameHost(c, startUrl)) continue;

      if (c.endsWith(".js") || c.endsWith(".css") || c.endsWith(".map")) assets.push(c);
      else q.push({ url: c, depth: cur.depth + 1 });
    }
  }

  return { pages: Array.from(new Set(pages)), assets: Array.from(new Set(assets)) };
}
