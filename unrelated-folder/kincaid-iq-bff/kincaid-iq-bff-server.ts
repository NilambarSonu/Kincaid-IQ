import express from "express";
import { config } from "./src/config.js";
import { db, migrate } from "./src/db.js";
import router from "./src/routes.js";
import { isSeeded, seedDemo } from "./seed.js";

// Fail closed: DEMO_OPEN_AUTH lets any caller self-select a role via header. It is
// strictly a demo affordance and must never run in production.
if (config.demoOpenAuth && config.env === "production") {
  console.error(
    "Refusing to start: DEMO_OPEN_AUTH is enabled while NODE_ENV=production. Set DEMO_OPEN_AUTH=0 and wire the 8 role RBAC sign-in.",
  );
  process.exit(1);
}

migrate();

// Auto-seed if the database is empty so npm run dev boots a working demo with no
// extra step. An already-seeded database is left untouched.
if (!isSeeded()) {
  const res = seedDemo();
  console.log(`Auto-seeded demo: ${res.plans} plans, ${res.claims} claims, DRAP $${res.drap.toLocaleString("en-US")}.`);
}

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(router);

app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    `Kincaid IQ BFF listening on port ${config.port} (env=${config.env}, demoOpenAuth=${config.demoOpenAuth}).`,
  );
  console.log(`Executive surface: GET http://127.0.0.1:${config.port}/tiles/executive`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
