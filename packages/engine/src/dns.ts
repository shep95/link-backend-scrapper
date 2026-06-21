import { resolve4, resolve6, resolveCname, resolveTxt } from "node:dns/promises";

export async function collectDns(host: string): Promise<{
  a: string[];
  aaaa: string[];
  cname: string[];
  txt: string[];
}> {
  const [a, aaaa, cname, txt] = await Promise.allSettled([
    resolve4(host),
    resolve6(host),
    resolveCname(host),
    resolveTxt(host)
  ]);

  return {
    a: a.status === "fulfilled" ? a.value : [],
    aaaa: aaaa.status === "fulfilled" ? aaaa.value : [],
    cname: cname.status === "fulfilled" ? cname.value : [],
    txt: txt.status === "fulfilled" ? txt.value.flat().filter(Boolean) : []
  };
}
