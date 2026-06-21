import tls from "node:tls";

export type TlsProbeResult = {
  connected: boolean;
  sans: string[];
};

export async function getTlsSans(host: string, port = 443): Promise<TlsProbeResult> {
  return await new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: 7000
      },
      () => {
        const cert = socket.getPeerCertificate(true) as tls.PeerCertificate & {
          subjectaltname?: string;
        };
        const sanRaw = cert.subjectaltname ?? "";
        const sans = sanRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.toLowerCase().startsWith("dns:"))
          .map((s) => s.slice(4).trim())
          .filter(Boolean);
        socket.end();
        resolve({ connected: true, sans: Array.from(new Set(sans)) });
      }
    );

    socket.on("error", () => resolve({ connected: false, sans: [] }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ connected: false, sans: [] });
    });
  });
}
