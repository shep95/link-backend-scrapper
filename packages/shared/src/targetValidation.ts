const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i
];

export function isPrivateOrReservedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h.endsWith(".local") || h.endsWith(".internal") || h === "0.0.0.0") return true;
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(h));
}

export function isValidScanTarget(raw: string): boolean {
  try {
    const withScheme = raw.includes("://") ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname;
    if (!host || isPrivateOrReservedHost(host)) return false;
    return true;
  } catch {
    return false;
  }
}
