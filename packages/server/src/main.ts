import { createApp } from "./routes.js";
import { migrate, openDb } from "@ghostchain/storage";

const port = Number(process.env.PORT ?? 8787);
const user = process.env.DASHBOARD_USER ?? "admin";
const pass = process.env.DASHBOARD_PASS ?? "change_me";
const sqlitePath = process.env.SQLITE_PATH ?? "./data/ghostchain.sqlite";

const db = openDb(sqlitePath);
migrate(db);

const app = createApp(db, { user, pass });
app.listen(port, () => {
  console.log(`GhostChain dashboard → http://localhost:${port}`);
});
