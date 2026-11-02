// HTTP client for the Zernio REST API. See API_SPEC.md for endpoints and shapes.
import { config } from "../../config.js";
import { AppError } from "../../errors.js";

function query(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// Zernio's error envelope is { error, type, code }. Map it to an AppError the routes can send.
function toError(status, body) {
  const message =
    (typeof body?.error === "string" && body.error) || body?.error?.message || body?.message || `Zernio request failed (${status})`;
  const code =
    status === 401 ? "auth" : status === 402 ? "payment_required" : status === 429 ? "rate_limited" : body?.code || "provider_error";
  return new AppError(message, { status: status >= 500 ? 502 : status, code });
}

export async function request(method, path, { params, body, headers, key } = {}) {
  const apiKey = key ?? config.apiKey;
  if (!apiKey) throw new AppError("No Zernio API key configured. Add it in Settings", { status: 401, code: "missing_key" });
  let res;
  try {
    res = await fetch(config.apiBase + path + query(params), {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new AppError(`Could not reach Zernio: ${err.message}`, { status: 502, code: "unreachable" });
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 200) };
  }
  if (!res.ok) throw toError(res.status, data);
  return data;
}

export const get = (path, params, opts) => request("GET", path, { params, ...opts });
export const post = (path, body, opts) => request("POST", path, { body: body ?? {}, ...opts });
export const put = (path, body) => request("PUT", path, { body: body ?? {} });
export const patch = (path, body) => request("PATCH", path, { body: body ?? {} });
export const del = (path, params) => request("DELETE", path, { params });

// Shared helpers for mappers
export const n = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
export const s = (v) => (v === undefined || v === null ? null : String(v));
