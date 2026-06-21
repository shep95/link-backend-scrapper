export type ScopeConfig = {
  allowHosts: string[];
  allowCidrs?: string[];
  allowPorts: number[];
  denyPathPrefixes: string[];
};

export function isHostAllowed(host: string, allowHosts: string[]): boolean {
  const h = host.toLowerCase();
  return allowHosts.some((a) => {
    const aa = a.toLowerCase().trim();
    if (aa.startsWith("*.")) {
      const suffix = aa.slice(2);
      return h === suffix || h.endsWith(`.${suffix}`);
    }
    return h === aa;
  });
}

export function buildAllowHostsForTarget(host: string): string[] {
  const h = host.toLowerCase();
  const parts = h.split(".").filter(Boolean);
  const allow = [h];
  if (parts.length >= 2) {
    allow.push(`*.${parts.slice(-2).join(".")}`);
  }
  return allow;
}

export function isPathDenied(pathname: string, denyPathPrefixes: string[]): boolean {
  if (denyPathPrefixes.length === 0) return false;
  const p = pathname.toLowerCase();
  return denyPathPrefixes.some((prefix) => p.startsWith(prefix.toLowerCase()));
}
