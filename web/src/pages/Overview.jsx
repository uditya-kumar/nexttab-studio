import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, RefreshCw, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "../lib/account.jsx";
import { useAutomations, useConversations, useInsights, usePublished, useQueued, useReach } from "../lib/queries.js";
import { ago, compactNum, dateLong, dateShort, dateTime, num, rangeFor, short } from "../lib/format.js";
import { automateLink, postTitle, unautomated } from "../lib/posts.js";
import { LineChart } from "../components/charts.jsx";
import { Avatar, Empty, ErrorNotice, ICON, Key, PageHead, Segmented, Skeleton, Stat, Thumb } from "../components/ui.jsx";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export default function Overview() {
  const { accountId, account } = useAccount();
  const [days, setDays] = useState(30);
  const r = rangeFor(days);
  const qc = useQueryClient();

  const insights = useInsights(accountId, r.from, r.to);
  const previous = useInsights(accountId, r.prevFrom, r.prevTo);
  const reach = useReach(accountId, r.from, r.to);
  const top = usePublished(accountId, { from: r.from, to: r.to, sort: "views", limit: 8 });

  const t = insights.data?.totals || {};
  const p = previous.isError ? {} : previous.data?.totals || {};
  const series = reach.data || [];
  const best = series.reduce((b, d) => (d.value > (b?.value ?? -1) ? d : b), null);
  const topPosts = top.data?.posts || [];

  return (
    <div className="page">
      <PageHead
        title="Overview"
        sub={`${dateLong(r.from)} to ${dateLong(r.to)} · ${num(account?.followers)} followers · Instagram data can lag up to 48 hours`}
      >
        <Segmented value={days} onChange={setDays} options={RANGES} label="Date range" />
        <button className="btn icon" aria-label="Refresh" title="Refresh" onClick={() => qc.invalidateQueries()}>
          <RefreshCw {...ICON} />
        </button>
      </PageHead>

      {insights.isError && <ErrorNotice error={insights.error} onRetry={insights.refetch} />}

      <div className="grid stats">
        <Stat lead label="Reach" value={short(t.reach)} current={t.reach} previous={p.reach} days={days} />
        <Stat label="Views" value={short(t.views)} current={t.views} previous={p.views} days={days} />
        <Stat label="Accounts engaged" value={short(t.accountsEngaged)} current={t.accountsEngaged} previous={p.accountsEngaged} days={days} />
        <Stat label="Interactions" value={short(t.interactions)} current={t.interactions} previous={p.interactions} days={days} />
      </div>

      <div className="grid main-side equal-row" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Daily reach</h2>
              <span className="card-sub">Accounts reached per day</span>
            </div>
            {best?.value > 0 && (
              <span className="peak">
                Best day <b>{dateShort(best.date)} · {num(best.value)}</b>
              </span>
            )}
          </div>
          {reach.isLoading ? (
            <Skeleton h={300} />
          ) : reach.isError ? (
            <ErrorNotice error={reach.error} onRetry={reach.refetch} />
          ) : (
            <LineChart data={series} label="Reach" />
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Top posts by views</h2>
            <Link to="/analytics" className="btn ghost sm">
              All posts
            </Link>
          </div>
          {top.isLoading ? (
            <Skeleton h={260} />
          ) : topPosts.length ? (
            <div className="top-posts">
              {topPosts.map((post, i) => (
                <a className="top-post" key={post.id} href={post.url || undefined} target="_blank" rel="noreferrer">
                  <Thumb src={post.thumbnailUrl} />
                  <span className="body">
                    <span className="line">
                      <span className="caption ellipsis">{postTitle(post, 90)}</span>
                      <span className="mono views">
                        {compactNum(post.metrics.views)} <span className="muted">views</span>
                      </span>
                    </span>
                    <span className="track">
                      <span
                        className={i === 0 ? "fill lead" : "fill"}
                        style={{ width: `${Math.max(1, ((post.metrics.views || 0) / (topPosts[0].metrics.views || 1)) * 100)}%` }}
                      />
                    </span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <Empty title="No posts in this period" />
          )}
        </div>
      </div>

      <div className="grid thirds section equal-row" style={{ marginTop: 16 }}>
        <AutomationSummary />
        <RecentMessages />
        <UpNext />
      </div>
    </div>
  );
}

function AutomationSummary() {
  const { accountId } = useAccount();
  const automations = useAutomations();
  const recent = usePublished(accountId, { limit: 24 });
  const list = automations.data || [];
  const missing = unautomated(recent.data?.posts, list).slice(0, Math.max(0, 4 - list.length));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Comment automations</h2>
        <Link to="/automations" className="btn ghost sm">
          Manage
        </Link>
      </div>
      {automations.isLoading ? (
        <Skeleton h={120} />
      ) : list.length || missing.length ? (
        <div className="rows">
          {list.slice(0, 4).map((a) => (
            <Link to="/automations" className="row" key={a.id}>
              <span className={`dot ${a.active ? "on" : ""}`} title={a.active ? "Live" : "Paused"} />
              <div className="grow">
                <div className="ellipsis">{a.name}</div>
                <div className="keys" style={{ marginTop: 6 }}>
                  {a.keywords.slice(0, 3).map((k) => (
                    <Key key={k} sm lit={a.active}>
                      {k}
                    </Key>
                  ))}
                  {!a.keywords.length && <span className="mono muted">Any comment</span>}
                </div>
              </div>
              <div className="figure-r">
                <span className="num">{num(a.stats.dmsSent)}</span>
                <span className="mono muted">DMs sent</span>
              </div>
            </Link>
          ))}
          {missing.map(({ post, keyword }) => (
            <div className="row" key={post.id}>
              <span className="dot" title="Not automated" />
              <div className="grow">
                <div className="ellipsis">{postTitle(post, 40)}</div>
                <div className="keys" style={{ marginTop: 6 }}>
                  <Key sm>{keyword}</Key>
                </div>
              </div>
              <Link className="btn sm" to={automateLink(post, keyword)}>
                <Zap size={14} strokeWidth={1.5} /> Automate
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No automations yet" actions={<Link className="btn sm" to="/automations/new">New automation</Link>} />
      )}
    </div>
  );
}

function RecentMessages() {
  const { accountId } = useAccount();
  const convos = useConversations(accountId);
  const list = convos.data?.pages?.[0]?.items || [];
  return (
    <div className="card">
      <div className="card-head">
        <h2>Latest messages</h2>
        <Link to="/inbox" className="btn ghost sm">
          Open inbox
        </Link>
      </div>
      {convos.isLoading ? (
        <Skeleton h={120} />
      ) : convos.isError ? (
        <ErrorNotice error={convos.error} />
      ) : list.length ? (
        <div className="rows">
          {list.slice(0, 4).map((c) => (
            <Link to={`/inbox?c=${encodeURIComponent(c.id)}`} className="row" key={c.id}>
              <Avatar src={c.avatarUrl} name={c.name} />
              <div className="grow">
                <div className="ellipsis">{c.name}</div>
                <div className="ellipsis muted">{c.lastMessage}</div>
              </div>
              <span className="mono muted">{ago(c.updatedAt)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="No conversations yet" />
      )}
    </div>
  );
}

function UpNext() {
  const { accountId } = useAccount();
  const scheduled = useQueued(accountId, "scheduled");
  const list = scheduled.data || [];
  return (
    <div className="card">
      <div className="card-head">
        <h2>Scheduled</h2>
        <Link to="/compose" className="btn ghost sm">
          New post
        </Link>
      </div>
      {scheduled.isLoading ? (
        <Skeleton h={120} />
      ) : list.length ? (
        <div className="rows">
          {list.slice(0, 4).map((post) => (
            <Link to={`/compose/${post.id}`} className="row" key={post.id}>
              <div className="grow">
                <div className="ellipsis">{postTitle(post)}</div>
                <div className="mono muted">{dateTime(post.scheduledFor)}</div>
              </div>
              <ArrowUpRight {...ICON} className="muted" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-fill">
          <Empty
            title="Nothing scheduled"
            actions={
              <Link className="btn sm" to="/compose">
                <CalendarClock size={14} strokeWidth={1.5} /> Schedule a reel
              </Link>
            }
          >
            Reels you schedule appear here with their publish time
          </Empty>
        </div>
      )}
    </div>
  );
}
