import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Download } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { useBestTimes, useDemographics, useInsights, useOnlineFollowers, usePostTimeline, usePublished } from "../lib/queries.js";
import { WEEKDAYS, country, dateLong, dateShort, dateTime, num, pct, rangeFor, seconds, tz } from "../lib/format.js";
import { KIND_LABEL, postTitle } from "../lib/posts.js";
import { downloadCsv } from "../lib/csv.js";
import { BarList, Bars, Heatmap, LineChart } from "../components/charts.jsx";
import { Drawer, Empty, ErrorNotice, Key, PageHead, Segmented, Skeleton, Thumb } from "../components/ui.jsx";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const STRIP = [
  ["reach", "Reach"],
  ["views", "Views"],
  ["accountsEngaged", "Accounts engaged"],
  ["profileViews", "Profile views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["saves", "Saves"],
  ["shares", "Shares"],
];

const BAR_METRICS = [
  { value: "views", label: "Views" },
  { value: "reach", label: "Reach" },
  { value: "saves", label: "Saves" },
  { value: "shares", label: "Shares" },
];

const COLUMNS = [
  ["views", "Views"],
  ["reach", "Reach"],
  ["likes", "Likes"],
  ["saves", "Saves"],
  ["shares", "Shares"],
  ["avgWatchMs", "Avg watch"],
  ["skipRate", "Skip rate"],
  ["engagementRate", "Eng. rate"],
];

const cell = (key, v) => (key === "avgWatchMs" ? seconds(v) : key === "skipRate" || key === "engagementRate" ? pct(v, key === "skipRate" ? 1 : 2) : num(v));

export default function Analytics() {
  const { accountId } = useAccount();
  const [days, setDays] = useState(30);
  const r = rangeFor(days);
  const insights = useInsights(accountId, r.from, r.to);
  const published = usePublished(accountId, { from: r.from, to: r.to, sort: "date", limit: 100 });
  const posts = published.data?.posts || [];
  // Some engagement totals are not always reported at account level. Fall back to the sum
  // over the posts published in the range, which is what Instagram counts there anyway.
  const t = { ...(insights.data?.totals || {}) };
  for (const k of ["likes", "comments", "saves", "shares"]) {
    if ((t[k] === null || t[k] === undefined) && posts.length) t[k] = posts.reduce((a, p) => a + (p.metrics[k] || 0), 0);
  }

  const first = posts.length ? posts[posts.length - 1].publishedAt : null;
  const last = posts.length ? posts[0].publishedAt : null;

  return (
    <div className="page">
      <PageHead
        title="Analytics"
        sub={
          posts.length
            ? `${num(posts.length)} posts published between ${dateShort(first)} and ${dateShort(last)}`
            : `${dateLong(r.from)} to ${dateLong(r.to)}`
        }
      >
        <Segmented value={days} onChange={setDays} options={RANGES} label="Date range" />
      </PageHead>

      {insights.isError && <ErrorNotice error={insights.error} onRetry={insights.refetch} />}

      <div className="metric-strip">
        {STRIP.map(([k, label], i) => (
          <div key={k} className={i === 0 ? "lead" : ""}>
            <span className="label">{label}</span>
            <span className="value">{insights.isLoading ? "–" : num(t[k])}</span>
          </div>
        ))}
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <ByDay posts={posts} loading={published.isLoading} />
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <PostTable posts={posts} loading={published.isLoading} error={published.error} range={r} />
      </div>

      <div className="grid main-side equal-row" style={{ marginTop: 16 }}>
        <OnlineCard />
        <BestTimesCard />
      </div>

      <Audience />
    </div>
  );
}

function ByDay({ posts, loading }) {
  const [metric, setMetric] = useState("views");
  const items = useMemo(() => {
    const byDay = new Map();
    for (const p of posts) {
      if (!p.publishedAt) continue;
      const d = new Date(p.publishedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const e = byDay.get(key) || { key, date: d, value: 0 };
      e.value += p.metrics[metric] || 0;
      byDay.set(key, e);
    }
    return [...byDay.values()].sort((a, b) => a.date - b.date).map((e) => ({ key: e.key, label: dateShort(e.date), value: e.value }));
  }, [posts, metric]);
  const top = items.reduce((b, i) => (i.value > (b?.value ?? -1) ? i : b), null);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{BAR_METRICS.find((m) => m.value === metric).label} by publish day</h2>
          <span className="card-sub">Lifetime totals of the posts published each day</span>
        </div>
        <Segmented value={metric} onChange={setMetric} options={BAR_METRICS} label="Metric" />
      </div>
      {loading ? <Skeleton h={260} /> : items.length ? <Bars items={items} highlight={top?.key} /> : <Empty title="No posts in this period" />}
    </div>
  );
}

// Raw values, so spreadsheets can sort and sum them. Rates are percentages, watch time is seconds.
const CSV_COLUMNS = [
  { label: "Caption", value: (p) => p.caption },
  { label: "Type", value: (p) => KIND_LABEL[p.kind] },
  { label: "Published", value: (p) => p.publishedAt?.slice(0, 10) },
  { label: "URL", value: (p) => p.url },
  { label: "Views", value: (p) => p.metrics.views },
  { label: "Reach", value: (p) => p.metrics.reach },
  { label: "Likes", value: (p) => p.metrics.likes },
  { label: "Comments", value: (p) => p.metrics.comments },
  { label: "Saves", value: (p) => p.metrics.saves },
  { label: "Shares", value: (p) => p.metrics.shares },
  { label: "Avg watch (s)", value: (p) => (p.metrics.avgWatchMs === null ? null : (p.metrics.avgWatchMs / 1000).toFixed(1)) },
  { label: "Skip rate (%)", value: (p) => p.metrics.skipRate },
  { label: "Engagement rate (%)", value: (p) => p.metrics.engagementRate },
];

function PostTable({ posts, loading, error, range }) {
  const [sort, setSort] = useState({ key: "views", dir: "desc" });
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => {
    const k = sort.key;
    const val = (p) => (k === "publishedAt" ? Date.parse(p.publishedAt || 0) : p.metrics[k] ?? -1);
    return [...posts].sort((a, b) => (sort.dir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [posts, sort]);
  const maxViews = Math.max(0, ...posts.map((p) => p.metrics.views || 0));
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  const Arrow = sort.dir === "desc" ? ArrowDown : ArrowUp;

  const head = (key, label, right = true) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === key ? (sort.dir === "desc" ? "descending" : "ascending") : undefined}>
      <button onClick={() => toggle(key)}>
        {label}
        {sort.key === key && <Arrow size={12} strokeWidth={1.5} />}
      </button>
    </th>
  );

  return (
    <div className="card flush">
      <div className="card-head" style={{ padding: "16px 20px", margin: 0 }}>
        <h2>Post performance</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="mono muted">Click a row for its daily curve</span>
          <button
            className="btn sm"
            disabled={!posts.length}
            onClick={() => downloadCsv(`nexttab-posts-${range.from}-to-${range.to}.csv`, CSV_COLUMNS, sorted)}
          >
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </button>
        </div>
      </div>
      {error ? (
        <div style={{ padding: 20 }}>
          <ErrorNotice error={error} />
        </div>
      ) : loading ? (
        <div style={{ padding: 20 }}>
          <Skeleton h={300} />
        </div>
      ) : !posts.length ? (
        <Empty title="No posts in this period" />
      ) : (
        <div className="table-wrap table-scroll scrollbar" style={{ borderTop: "1px solid var(--line)" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Post</th>
                {head("publishedAt", "Published", false)}
                {COLUMNS.map(([k, l]) => head(k, l))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setOpen(p)}>
                  <td>
                    <div className="post-cell">
                      <Thumb src={p.thumbnailUrl} />
                      <div className="text">
                        <span className="clamp-2">{postTitle(p, 90)}</span>
                        <span className="mono muted">{KIND_LABEL[p.kind]}</span>
                      </div>
                    </div>
                  </td>
                  <td className="mono secondary">{dateShort(p.publishedAt)}</td>
                  {COLUMNS.map(([k]) => (
                    <td key={k} className={`r ${k === "views" && p.metrics.views === maxViews ? "num-lead" : ""}`}>
                      {cell(k, p.metrics[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <PostDrawer post={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PostDrawer({ post, onClose }) {
  const timeline = usePostTimeline(post.id);
  const data = (timeline.data || []).map((d) => ({ date: d.date, value: d.views }));
  return (
    <Drawer
      title="Post details"
      onClose={onClose}
      actions={
        post.url && (
          <a className="btn ghost sm" href={post.url} target="_blank" rel="noreferrer">
            <ArrowUpRight size={14} strokeWidth={1.5} /> Instagram
          </a>
        )
      }
    >
      <div className="post-cell" style={{ marginBottom: 20 }}>
        <Thumb src={post.thumbnailUrl} lg />
        <div className="text">
          <span>{postTitle(post, 120)}</span>
          <span className="mono muted">
            {KIND_LABEL[post.kind]} · {dateTime(post.publishedAt)}
          </span>
        </div>
      </div>
      <h3 style={{ marginBottom: 12 }}>Views per day</h3>
      {timeline.isLoading ? (
        <Skeleton h={220} />
      ) : timeline.isError ? (
        <ErrorNotice error={timeline.error} />
      ) : data.length > 1 ? (
        <LineChart data={data} height={220} label="Views" />
      ) : (
        <p className="muted">Not enough daily data for this post yet</p>
      )}
      <div style={{ marginTop: 20 }}>
        {COLUMNS.map(([k, l]) => (
          <div className="kv" key={k}>
            <span>{l}</span>
            <span>{cell(k, post.metrics[k])}</span>
          </div>
        ))}
        <div className="kv">
          <span>Comments</span>
          <span>{num(post.metrics.comments)}</span>
        </div>
      </div>
    </Drawer>
  );
}

// Buckets UTC hourly samples into the viewer's weekday and hour, each relative to its day's average.
function toMatrix(samples) {
  const byDay = new Map();
  for (const s of samples) {
    const d = new Date(s.at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push({ d, v: s.value });
  }
  const sum = Array.from({ length: 7 }, () => Array(24).fill(0));
  const cnt = Array.from({ length: 7 }, () => Array(24).fill(0));
  const keys = [...byDay.keys()].slice(-15);
  for (const key of keys) {
    const list = byDay.get(key);
    const mean = list.reduce((a, x) => a + x.v, 0) / list.length;
    if (!mean) continue;
    for (const { d, v } of list) {
      sum[d.getDay()][d.getHours()] += v / mean;
      cnt[d.getDay()][d.getHours()]++;
    }
  }
  return sum.map((row, d) => row.map((v, h) => (cnt[d][h] ? v / cnt[d][h] : null)));
}

function OnlineCard() {
  const { accountId } = useAccount();
  const online = useOnlineFollowers(accountId);
  const matrix = useMemo(() => toMatrix(online.data || []), [online.data]);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>When your followers are online</h2>
          <span className="card-sub">Last 14 days in {tz()}. Amber hours beat the day's average</span>
        </div>
      </div>
      {online.isLoading ? (
        <Skeleton h={260} />
      ) : online.isError ? (
        <ErrorNotice error={online.error} />
      ) : online.data?.length ? (
        <Heatmap matrix={matrix} />
      ) : (
        <Empty title="No data yet">Instagram shares this once an account has 100 followers</Empty>
      )}
    </div>
  );
}

// Best-time slots come in UTC. Shift them to the viewer's weekday and wall time.
function localSlot(weekday, hour) {
  const ref = Date.UTC(2026, 10, 1); // a Sunday
  const d = new Date(ref + (weekday * 24 + hour) * 3600_000);
  return { day: WEEKDAYS[d.getDay()], time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}

function BestTimesCard() {
  const { accountId } = useAccount();
  const best = useBestTimes(accountId);
  const slots = (best.data || []).slice(0, 5);
  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <div>
          <h2>Best times to post</h2>
          <span className="card-sub">Average engagement of posts published in that hour</span>
        </div>
      </div>
      {best.isLoading ? (
        <Skeleton h={260} />
      ) : best.isError ? (
        <ErrorNotice error={best.error} />
      ) : slots.length ? (
        <div>
          {slots.map((s, i) => {
            const l = localSlot(s.weekday, s.hour);
            return (
              <div className="slot" key={`${s.weekday}-${s.hour}`}>
                <Key lit={i === 0}>{l.time}</Key>
                <div className="grow">
                  <div>{l.day}</div>
                  <div className="mono muted">
                    {s.posts} {s.posts === 1 ? "post" : "posts"}
                  </div>
                </div>
                <div className="figure-r">
                  <span className="num">{num(s.avgEngagement)}</span>
                  <span className="mono muted">avg engagement</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="Not enough posts yet" />
      )}
    </div>
  );
}

const AGE = (k) => k.replace("-", " to ").replace("65+", "65 and over");
const GENDER = { male: "Men", female: "Women", unknown: "Not specified" };

function Audience() {
  const { accountId } = useAccount();
  const [audience, setAudience] = useState("followers");
  const demo = useDemographics(accountId, audience);
  const g = demo.data || {};
  const gender = g.gender || [];
  const gTotal = gender.reduce((a, x) => a + x.value, 0) || 1;
  const order = ["male", "unknown", "female"];
  const genderSorted = [...gender].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const colors = ["var(--accent-fill)", "var(--data-mid)", "var(--raised-2)"];

  return (
    <>
      <div className="page-head" style={{ marginTop: 32, marginBottom: 12 }}>
        <div>
          <h2>Audience</h2>
          <span className="card-sub">
            {audience === "followers" ? "Who follows you" : "Who engaged with you"} this month. Instagram shows the top 45 per group
          </span>
        </div>
        <Segmented
          value={audience}
          onChange={setAudience}
          options={[
            { value: "followers", label: "Followers" },
            { value: "engaged", label: "Engaged viewers" },
          ]}
          label="Audience"
        />
      </div>
      {demo.isError ? (
        <ErrorNotice error={demo.error} onRetry={demo.refetch} />
      ) : (
        <div className="grid audience">
          <div className="card">
            <h2 style={{ marginBottom: 16 }}>Top countries</h2>
            {demo.isLoading ? (
              <Skeleton h={260} />
            ) : (
              <BarList items={(g.country || []).slice(0, 7).map((c) => ({ key: c.key, name: country(c.key), value: c.value }))} />
            )}
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 16 }}>Age</h2>
            {demo.isLoading ? <Skeleton h={260} /> : <BarList items={(g.age || []).map((a) => ({ key: a.key, name: AGE(a.key), value: a.value }))} />}
          </div>
          <div className="stack-col">
            <div className="card">
              <h2 style={{ marginBottom: 16 }}>Gender</h2>
              {demo.isLoading ? (
                <Skeleton h={80} />
              ) : (
                <>
                  <div className="stack">
                    {genderSorted.map((x) => (
                      <div key={x.key} style={{ width: `${(x.value / gTotal) * 100}%` }} />
                    ))}
                  </div>
                  <div className="rows" style={{ marginTop: 12 }}>
                    {genderSorted.map((x, i) => (
                      <div key={x.key} className="kv" style={{ border: 0, padding: "4px 0" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text)" }}>
                          <i style={{ width: 8, height: 8, borderRadius: 2, background: colors[i] }} />
                          {GENDER[x.key]}
                        </span>
                        <span>
                          <span className="secondary">{num(x.value)}</span>&nbsp;&nbsp;{pct((x.value / gTotal) * 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Top cities</h2>
              {demo.isLoading ? (
                <Skeleton h={120} />
              ) : (
                (g.city || []).slice(0, 5).map((c, i) => (
                  <div className="kv" key={c.key} style={{ padding: "6px 0" }}>
                    <span style={i === 0 ? { color: "var(--text)" } : undefined}>{c.key}</span>
                    <span className="secondary">{num(c.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
