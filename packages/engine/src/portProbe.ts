import net from "node:net";

export async function tcpConnect(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return await new Promise((resolve) => {
    const s = new net.Socket();
    const done = (ok: boolean) => {
      s.removeAllListeners();
      try {
        s.destroy();
      } catch {}
      resolve(ok);
    };
    s.setTimeout(timeoutMs);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
    s.connect(port, host);
  });
}
