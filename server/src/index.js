// Starts the server. Railway sets PORT and DATABASE_URL; without DATABASE_URL it runs on memory (for local tries).
"use strict";
const http = require("http");
const { createApp } = require("./app");

async function main() {
  const url = process.env.DATABASE_URL;
  let store;
  if (url) store = require("./store-pg").pgStore(url);
  else { store = require("./store-memory").memoryStore(); console.warn("No DATABASE_URL: keeping everything in memory (lost on restart)."); }
  await store.init();
  const origins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const server = http.createServer(createApp({ store, origins }));
  server.requestTimeout = 30e3; server.headersTimeout = 15e3;
  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => console.log(`Roads of the North server on :${port} (${store.kind})`));
  const stop = () => server.close(() => store.close().finally(() => process.exit(0)));
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
main().catch((e) => { console.error(e); process.exit(1); });
