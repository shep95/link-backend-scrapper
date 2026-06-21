import { createApp } from "./routes.js";
import { migrate, openDb } from "@ghostchain/storage";

const portRaw = process.env.PORT ?? "8787";
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT "${portRaw}" — must be an integer between 1 and 65535`);
  process.exit(1);
}

const user = process.env.DASHBOARD_USER ?? "admin";
const pass = process.env.DASHBOARD_PASS ?? "change_me";
const sqlitePath = process.env.SQLITE_PATH ?? "./data/ghostchain.sqlite";

if (user === "admin" && pass === "change_me") {
  console.warn("WARNING: Using default dashboard credentials. Set DASHBOARD_USER and DASHBOARD_PASS.");
}

const db = openDb(sqlitePath);
migrate(db);

const app = createApp(db, { user, pass });
const server = app.listen(port, () => {
  console.log(`GhostChain dashboard → http://localhost:${port}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down…`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
