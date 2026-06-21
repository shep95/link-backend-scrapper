export type Scan = {
  id: string;
  created_at: string;
  mode: string;
  targets: string[];
  status: string;
};

export type Finding = {
  id: string;
  severity: string;
  type: string;
  url: string;
  evidence: { summary: string };
};

export type Notification = {
  id: string;
  severity: string;
  title: string;
  body: string;
  acknowledged_at?: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const client = {
  listScans: () => api<{ scans: Scan[] }>("/api/scans"),
  createScan: (body: { targets: string[]; mode?: string }) =>
    api<{ scan_id: string }>("/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
  getScan: (id: string) => api<{ scan: Scan; findings: Finding[] }>(`/api/scans/${id}`),
  listNotifications: () => api<{ notifications: Notification[] }>("/api/notifications"),
  ack: (id: string) => api<{ ok: boolean }>(`/api/notifications/${id}/ack`, { method: "POST" })
};
