import { client } from "./api.js";
import { setState, state } from "./state.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sevClass(s: string): string {
  return `pill pill-${s.toLowerCase()}`;
}

export function render(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">GhostChain</div>
        <p class="tagline">Defensive exposure scanner</p>
        <button id="new-scan" class="btn primary">New scan</button>
        <h3>Recent scans</h3>
        <ul class="scan-list">
          ${state.scans
            .map(
              (s) => `<li class="${state.selectedScanId === s.id ? "active" : ""}" data-id="${esc(s.id)}">
                <strong>${esc(s.mode)}</strong>
                <span>${esc(s.status)}</span>
                <small>${esc(s.targets[0] ?? "")}</small>
              </li>`
            )
            .join("")}
        </ul>
      </aside>
      <main class="main">
        ${state.error ? `<div class="alert">${esc(state.error)}</div>` : ""}
        <section class="grid">
          <div class="panel">
            <h2>Findings ${state.selectedScanId ? `<small>${esc(state.selectedScanId)}</small>` : ""}</h2>
            <table>
              <thead><tr><th>Severity</th><th>Type</th><th>URL</th><th>Summary</th></tr></thead>
              <tbody>
                ${
                  state.findings.length
                    ? state.findings
                        .map(
                          (f) => `<tr>
                    <td><span class="${sevClass(f.severity)}">${esc(f.severity)}</span></td>
                    <td>${esc(f.type)}</td>
                    <td class="mono">${esc(f.url)}</td>
                    <td>${esc(f.evidence.summary)}</td>
                  </tr>`
                        )
                        .join("")
                    : "<tr><td colspan='4'>Select a scan or run a new one.</td></tr>"
                }
              </tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Notifications</h2>
            <ul class="notifs">
              ${
                state.notifications.length
                  ? state.notifications
                      .map(
                        (n) => `<li class="${n.acknowledged_at ? "acked" : ""}">
                  <div class="row"><span class="${sevClass(n.severity)}">${esc(n.severity)}</span><strong>${esc(n.title)}</strong></div>
                  <p>${esc(n.body)}</p>
                  ${n.acknowledged_at ? "" : `<button class="btn small" data-ack="${esc(n.id)}">Acknowledge</button>`}
                </li>`
                      )
                      .join("")
                  : "<li>No notifications yet.</li>"
              }
            </ul>
          </div>
        </section>
      </main>
    </div>`;

  root.querySelector("#new-scan")?.addEventListener("click", async () => {
    const target = prompt("Target host or URL:");
    if (!target) return;
    setState({ loading: true, error: null });
    try {
      await client.createScan({ targets: [target], mode: "full" });
      await refresh();
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
      render();
    }
  });

  root.querySelectorAll(".scan-list li").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = (el as HTMLElement).dataset.id;
      if (!id) return;
      setState({ selectedScanId: id, loading: true });
      try {
        const data = await client.getScan(id);
        setState({ findings: data.findings, loading: false });
        render();
      } catch (e) {
        setState({ error: e instanceof Error ? e.message : String(e), loading: false });
        render();
      }
    });
  });

  root.querySelectorAll("[data-ack]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = (btn as HTMLElement).dataset.ack;
      if (!id) return;
      await client.ack(id);
      await refresh();
    });
  });
}

export async function refresh(): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const [scans, notifs] = await Promise.all([client.listScans(), client.listNotifications()]);
    setState({ scans: scans.scans, notifications: notifs.notifications, loading: false });
    render();
  } catch (e) {
    setState({ error: e instanceof Error ? e.message : String(e), loading: false });
    render();
  }
}
