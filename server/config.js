import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_PATH = path.join(ROOT, ".env");

dotenv.config({ path: ENV_PATH, quiet: true });

export const config = {
  get port() {
    return Number(process.env.PORT || 5177);
  },
  get apiBase() {
    return (process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1").replace(/\/$/, "");
  },
  get apiKey() {
    return (process.env.ZERNIO_API_KEY || "").trim();
  },
};

// Sets or replaces one key in .env and keeps the other lines and comments.
export function writeEnvValue(key, value) {
  const text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = text ? text.split(/\r?\n/) : [];
  const i = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
  process.env[key] = value;
}
