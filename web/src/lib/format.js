const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const num = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? "–" : nf.format(Math.round(Number(n))));
export const short = (n) => (n === null || n === undefined ? "–" : Math.abs(n) < 10000 ? num(n) : compact.format(n));
// Always compact above 1,000 (7.9K, 163.2K), for tight columns that compare values.
export const compactNum = (n) => (n === null || n === undefined ? "–" : Math.abs(n) < 1000 ? num(n) : compact.format(n));
export const pct = (n, digits = 1) => (n === null || n === undefined ? "–" : `${Number(n).toFixed(digits)}%`);

export function change(current, previous) {
  if (!previous || current === null || current === undefined) return null;
  return ((current - previous) / previous) * 100;
}

export function seconds(ms) {
  if (ms === null || ms === undefined) return "–";
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

// Dates
export const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const daysAgo = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
};

// The window [today - days + 1, today] and the same-length window before it.
export function rangeFor(days) {
  const to = new Date();
  const from = daysAgo(days - 1, to);
  const prevTo = daysAgo(1, from);
  const prevFrom = daysAgo(days - 1, prevTo);
  return { from: ymd(from), to: ymd(to), prevFrom: ymd(prevFrom), prevTo: ymd(prevTo), days };
}

const dShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dLong = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const tOnly = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export const dateShort = (d) => (d ? dShort.format(new Date(d)) : "–");
export const dateLong = (d) => (d ? dLong.format(new Date(d)) : "–");
export const dateTime = (d) => (d ? dTime.format(new Date(d)) : "–");
export const timeOnly = (d) => (d ? tOnly.format(new Date(d)) : "–");

export function ago(d) {
  if (!d) return "–";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return dateShort(d);
}

export const firstLine = (text, max = 90) => {
  const line = String(text || "").split("\n").find((l) => l.trim()) || "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export const initials = (name) =>
  String(name || "?")
    .replace(/[^a-zA-Z0-9 ._]/g, "")
    .split(/[ ._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export const country = (code) => {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
};
