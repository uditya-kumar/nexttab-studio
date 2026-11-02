import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config, ROOT } from "./config.js";
import { api } from "./routes/index.js";

const app = express();
app.disable("x-powered-by");

// This server holds an API key and binds to localhost, so it only answers
// requests addressed to localhost from this app's own pages. That blocks other
// websites (and DNS rebinding) from using the API through your browser.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
app.use("/api", (req, res, next) => {
  const host = (req.headers.host || "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host)) return res.status(403).json({ error: "Forbidden host" });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!LOCAL_HOSTS.has(new URL(origin).hostname)) return res.status(403).json({ error: "Forbidden origin" });
    } catch {
      return res.status(403).json({ error: "Forbidden origin" });
    }
  }
  next();
});

app.use("/api", api);

// Serves the built frontend. In development Vite serves it and proxies /api here.
const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.code ? "Server error" : err.message, code: err.code || "error" });
});

app.listen(config.port, "127.0.0.1", () => {
  const ui = fs.existsSync(dist) ? `http://localhost:${config.port}` : "http://localhost:5173 (run npm run dev)";
  console.log(`Nexttab Studio API on http://localhost:${config.port}`);
  console.log(`Open ${ui}`);
  if (!config.apiKey) console.log("No ZERNIO_API_KEY yet. Add it in Settings or in .env");
});
