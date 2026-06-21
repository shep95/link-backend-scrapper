import type { Finding, Notification, Scan } from "./api.js";

export type AppState = {
  scans: Scan[];
  selectedScanId: string | null;
  findings: Finding[];
  notifications: Notification[];
  loading: boolean;
  error: string | null;
};

export const state: AppState = {
  scans: [],
  selectedScanId: null,
  findings: [],
  notifications: [],
  loading: false,
  error: null
};

export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch);
}
