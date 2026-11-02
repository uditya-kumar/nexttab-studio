import { get, n, s } from "./client.js";

const INSIGHT_KEYS = {
  reach: "reach",
  views: "views",
  accounts_engaged: "accountsEngaged",
  total_interactions: "interactions",
  profile_views: "profileViews",
  likes: "likes",
  comments: "comments",
  saves: "saves",
  shares: "shares",
  website_clicks: "websiteClicks",
};

/** @returns {Promise<import("../../domain.js").Insights>} */
export async function getInsights(accountId, from, to) {
  const d = await get("/analytics/instagram/account-insights", {
    accountId,
    fromDate: from,
    toDate: to,
    metrics: Object.keys(INSIGHT_KEYS).join(","),
  });
  const totals = Object.fromEntries(Object.values(INSIGHT_KEYS).map((k) => [k, null]));
  for (const [zk, k] of Object.entries(INSIGHT_KEYS)) totals[k] = n(d.metrics?.[zk]?.total);
  return {
    range: { from: d.dateRange?.since || from, to: d.dateRange?.until || to },
    totals,
    unavailable: (d.unavailableMetrics || []).map((u) => INSIGHT_KEYS[u.metric] || u.metric),
  };
}

/** Daily reach. Instagram only offers a daily series for reach. */
export async function getReachSeries(accountId, from, to) {
  const d = await get("/analytics/instagram/account-insights", {
    accountId,
    fromDate: from,
    toDate: to,
    metrics: "reach",
    metricType: "time_series",
  });
  return (d.metrics?.reach?.values || []).map((v) => ({ date: v.date, value: n(v.value) ?? 0 }));
}

const KIND = (p) => {
  const t = String(p.mediaProductType || "").toUpperCase();
  if (t === "REELS") return "reel";
  if (t === "STORY") return "story";
  if (p.mediaType === "carousel") return "carousel";
  if (p.mediaType === "video") return "video";
  return "post";
};

/** @returns {import("../../domain.js").PublishedPost} */
function mapPublished(p) {
  const a = p.analytics || {};
  const ig = (p.platforms || []).find((x) => x.platform === "instagram");
  return {
    id: p._id,
    platformPostId: s(ig?.platformPostId),
    url: s(p.platformPostUrl || ig?.platformPostUrl),
    caption: p.content || "",
    publishedAt: s(p.publishedAt),
    kind: KIND(p),
    thumbnailUrl: s(p.thumbnailUrl || p.mediaItems?.[0]?.thumbnail),
    metrics: {
      views: n(a.views),
      reach: n(a.reach),
      likes: n(a.likes),
      comments: n(a.comments),
      shares: n(a.shares),
      saves: n(a.saves),
      engagementRate: n(a.engagementRate),
      avgWatchMs: n(a.igReelsAvgWatchTime),
      skipRate: n(a.reelsSkipRate),
    },
  };
}

const SORT = { date: "date", views: "views", reach: "reach", likes: "likes", comments: "comments", saves: "saves", shares: "shares", engagement: "engagement" };

/** @returns {Promise<import("../../domain.js").PostPage>} */
export async function getPublishedPosts(accountId, { from, to, sort = "date", order = "desc", page = 1, limit = 24 } = {}) {
  const d = await get("/analytics", {
    accountId,
    platform: "instagram",
    fromDate: from,
    toDate: to,
    sortBy: SORT[sort] || "date",
    order,
    page,
    limit,
  });
  const pg = d.pagination || {};
  return {
    posts: (d.posts || []).map(mapPublished),
    page: n(pg.page) ?? page,
    pages: n(pg.pages) ?? 1,
    total: n(pg.total) ?? (d.posts || []).length,
  };
}

/** Daily growth of one post. */
export async function getPostTimeline(postId) {
  const d = await get("/analytics/post-timeline", { postId });
  return (d.timeline || []).map((t) => ({ date: t.date, views: n(t.views) ?? 0, reach: n(t.reach) ?? 0, likes: n(t.likes) ?? 0, saves: n(t.saves) ?? 0, shares: n(t.shares) ?? 0 }));
}

/** @returns {Promise<import("../../domain.js").BestTime[]>} */
export async function getBestTimes(accountId) {
  const d = await get("/analytics/best-time", { accountId });
  return (d.slots || []).map((x) => ({
    weekday: x.day_of_week,
    hour: x.hour,
    avgEngagement: n(x.avg_engagement) ?? 0,
    posts: n(x.post_count) ?? 0,
  }));
}

// Zernio returns one entry per day with hours "0".."23" keyed from the start of that day,
// where the day ends at endTime. Flatten to UTC hourly samples so the browser can bucket
// them in the viewer's own time zone.
/** @returns {Promise<import("../../domain.js").OnlineSample[]>} */
export async function getOnlineFollowers(accountId) {
  const d = await get("/analytics/instagram/online-followers", { accountId });
  const out = [];
  for (const day of d.days || []) {
    const end = Date.parse(String(day.endTime).replace(/\+0000$/, "Z"));
    if (Number.isNaN(end)) continue;
    const start = end - 24 * 3600_000;
    for (let h = 0; h < 24; h++) {
      const v = day.hours?.[String(h)];
      out.push({ at: new Date(start + h * 3600_000).toISOString(), value: n(v) ?? 0 });
    }
  }
  return out;
}

const GENDER = { M: "male", F: "female", U: "unknown" };

/** @returns {Promise<import("../../domain.js").Demographics>} */
export async function getDemographics(accountId, audience = "followers") {
  const d = await get("/analytics/instagram/demographics", {
    accountId,
    metric: audience === "engaged" ? "engaged_audience_demographics" : "follower_demographics",
    breakdown: "age,country,gender,city",
    timeframe: "this_month",
  });
  const g = d.demographics || {};
  const list = (arr) => (arr || []).map((x) => ({ key: x.dimension, value: n(x.value) ?? 0 })).sort((a, b) => b.value - a.value);
  return {
    country: list(g.country),
    city: list(g.city).map((c) => ({ ...c, key: c.key.split(",")[0] })),
    age: list(g.age),
    gender: list(g.gender).map((x) => ({ key: GENDER[x.key] || "unknown", value: x.value })),
  };
}
