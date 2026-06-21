import { randomUUID, createHash } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
