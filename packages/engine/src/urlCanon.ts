export function canonicalizeUrl(input: string): string | null {
  try {
    const u = new URL(input);
    u.hash = "";
    if (!u.pathname) u.pathname = "/";
    return u.toString();
  } catch {
    return null;
  }
}

export function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}
