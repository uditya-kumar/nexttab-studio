import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dateShort, num, short } from "../lib/format.js";

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Monotone cubic interpolation, so the line never overshoots a day's value.
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Line chart for a daily series. data: [{ date, value }]. compare: optional same-length
 * series from the previous period, drawn as a quiet dashed line.
 */
export function LineChart({ data, compare, height = 300, label = "Value", compareLabel = "Previous period" }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 28, left: 44 };
  const w = Math.max(width - pad.left - pad.right, 10);
  const h = height - pad.top - pad.bottom;

  const { max, pts, cmp, ticks } = useMemo(() => {
    const all = [...data.map((d) => d.value), ...(compare || []).map((d) => d.value)];
    const max = niceMax(Math.max(0, ...all));
    const x = (i) => (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
    const y = (v) => h - (v / max) * h;
    const pts = data.map((d, i) => [x(i), y(d.value || 0)]);
    const cmp = compare?.length ? compare.slice(0, data.length).map((d, i) => [x(i), y(d.value || 0)]) : null;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    return { max, pts, cmp, ticks };
  }, [data, compare, w, h]);

  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(w / 72))));
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z` : "";

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    const i = Math.round((px / w) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${label} by day`}>
          <defs>
            <linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={0} x2={w} y1={h - (t / max) * h} y2={h - (t / max) * h} />
                <text className="axis" x={-10} y={h - (t / max) * h + 4} textAnchor="end">
                  {short(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text key={d.date} className="axis" x={pts[i][0]} y={h + 20} textAnchor="middle">
                  {dateShort(d.date)}
                </text>
              ) : null,
            )}
            {cmp && (
              <path d={smoothPath(cmp)} fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
            )}
            <path d={area} fill="url(#area-fade)" />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && pts[hover] && (
              <g>
                <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={h} stroke="var(--line-strong)" />
                <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
              </g>
            )}
          </g>
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(pad.left + pts[hover][0], 80), width - 80), top: 0 }}
        >
          <span className="mono muted">{dateShort(data[hover].date)}</span>
          <b>
            {num(data[hover].value)} <span className="muted" style={{ fontWeight: 400 }}>{label.toLowerCase()}</span>
          </b>
          {compare?.[hover] && (
            <span className="mono muted">
              {compareLabel}: {num(compare[hover].value)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Ranked list with thin bars. items: [{ key, name, value, display? }]
export function BarList({ items, format = num, max: forcedMax }) {
  const max = forcedMax ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className="item" key={i.key ?? i.name}>
          <span className="name">{i.name}</span>
          <span className="val">{i.display ?? format(i.value)}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Colour for a ratio to the day's average (1 = average). Below average stays a neutral
// step, above average turns amber, so only the hours worth posting in stand out.
function heatColor(v, lo, hi) {
  if (!v) return "var(--raised)";
  if (v < 1) {
    const t = lo < 1 ? (v - lo) / (1 - lo) : 1;
    return `rgba(237, 237, 237, ${(0.04 + 0.08 * t).toFixed(3)})`;
  }
  const t = hi > 1 ? Math.pow((v - 1) / (hi - 1), 1.6) : 1;
  return `rgba(245, 165, 36, ${(0.18 + 0.82 * t).toFixed(3)})`;
}

const relative = (v) => {
  const p = Math.round((v - 1) * 100);
  return p === 0 ? "about the day's average" : `${Math.abs(p)}% ${p > 0 ? "above" : "below"} the day's average`;
};

// matrix[weekday][hour] holds ratios to that day's average, null when there is no data.
export function Heatmap({ matrix }) {
  const flat = matrix.flat().filter(Boolean);
  const lo = Math.min(1, ...flat);
  const hi = Math.max(1, ...flat);
  const peak = useMemo(() => {
    let best = { v: 0, d: 0, hr: 0 };
    matrix.forEach((row, d) => row.forEach((v, hr) => v > best.v && (best = { v, d, hr })));
    return best;
  }, [matrix]);
  const [hover, setHover] = useState(null);
  const shown = hover || peak;

  return (
    <div>
      <div className="heat" onMouseLeave={() => setHover(null)}>
        <span />
        {Array.from({ length: 24 }, (_, hr) => (
          <span key={hr} className="hour">
            {hr % 3 === 0 ? String(hr).padStart(2, "0") : ""}
          </span>
        ))}
        {matrix.map((row, d) => (
          <Fragment key={d}>
            <span className="day">{DAYS[d]}</span>
            {row.map((v, hr) => (
              <span
                key={hr}
                className={`cell ${shown.d === d && shown.hr === hr && flat.length ? "on" : ""}`}
                style={{ background: heatColor(v, lo, hi) }}
                onMouseEnter={() => setHover({ d, hr, v })}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="heat-foot">
        <span className="mono secondary">
          {flat.length && shown.v
            ? `${DAYS[shown.d]} ${String(shown.hr).padStart(2, "0")}:00 · ${relative(shown.v)}`
            : "No data for this hour"}
        </span>
        <span className="heat-scale mono muted">
          Below average
          {[0.6, 0.9, 1.1, 1.25, 1.36].map((v) => (
            <i key={v} style={{ background: heatColor(v, 0.56, 1.36) }} />
          ))}
          Peak
        </span>
      </div>
    </div>
  );
}

// Vertical bars with one highlighted bar. items: [{ key, label, value }]
export function Bars({ items, highlight, height = 240, format = short }) {
  const max = niceMax(Math.max(0, ...items.map((i) => i.value)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => f * max);
  return (
    <div className="bars" style={{ "--bars-h": `${height}px` }}>
      <div className="bars-y">
        {ticks.map((t) => (
          <span key={t} className="axis-label">
            {short(t)}
          </span>
        ))}
      </div>
      <div className="bars-plot">
        {items.map((i) => (
          <div className="bar-col" key={i.key} title={`${i.label} · ${format(i.value)}`}>
            <div className="bar-area">
              <div className={`bar ${i.key === highlight ? "lit" : ""}`} style={{ height: `${Math.max(1, (i.value / max) * 100)}%` }} />
            </div>
            <span className="axis-label">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
