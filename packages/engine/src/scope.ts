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
    if (aa.startsWith("*.")) return h === aa.slice(2) || h.endsWith(`.${aa.slice(2)}`);
    return h === aa;
  });
}
