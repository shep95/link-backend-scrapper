import { timingSafeEqual } from "node:crypto";

export function checkBasicAuth(
  header: string | undefined,
  user: string,
  pass: string
): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const expected = `${user}:${pass}`;
  const a = Buffer.from(decoded);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GhostChain"' }
  });
}
