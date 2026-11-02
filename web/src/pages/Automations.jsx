import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  CircleDashed,
  Ellipsis,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAction, useAutomationActivity, useAutomations, usePublished, useWorkflows } from "../lib/queries.js";
import { ago, dateShort, num, timeOnly } from "../lib/format.js";
import { automateLink, postTitle, unautomated } from "../lib/posts.js";
import { useToast } from "../components/Toast.jsx";
import { Drawer, Empty, ErrorNotice, ICON, Key, PageHead, Segmented, Skeleton, Switch, Thumb, useConfirm } from "../components/ui.jsx";

const WHERE = { comment: "Comments", story_reply: "Story replies", story_mention: "Story mentions", live_comment: "Live comments" };
const TRIGGER_ICON = { story_reply: CircleDashed, story_mention: AtSign, live_comment: Radio };

const SORTS = {
  dms: { label: "Most DMs", fn: (a, b) => b.stats.dmsSent - a.stats.dmsSent },
  newest: { label: "Newest", fn: (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0) },
  name: { label: "Name", fn: (a, b) => a.name.localeCompare(b.name) },
};

const needsAttention = (a) => a.stats.failed > 0;

export default function Automations() {
  const { accountId } = useAccount();
  const automations = useAutomations();
  const published = usePublished(accountId, { limit: 50 });
  const posts = published.data?.posts || [];
  const byPost = useMemo(() => new Map(posts.map((p) => [p.platformPostId, p])), [posts]);
  const list = automations.data || [];
  const missing = unautomated(posts, list);
  const [reviewOpen, setReviewOpen] = useState(false);

  const totals = list.reduce(
    (t, a) => ({
      live: t.live + (a.active ? 1 : 0),
      paused: t.paused + (a.active ? 0 : 1),
      dms: t.dms + a.stats.dmsSent,
      failed: t.failed + a.stats.failed,
      clicks: t.clicks + a.stats.linkClicks,
      people: t.people + a.stats.people,
    }),
    { live: 0, paused: 0, dms: 0, failed: 0, clicks: 0, people: 0 },
  );

  return (
    <div className="page">
      <PageHead
        title="Automations"
        sub={list.length ? `${num(list.length)} automations reply to comments and story replies with a DM` : "Someone comments a keyword, they get a public reply and the repo link by DM"}
      >
        <Link to="/automations/new" className="btn accent">
          <Plus {...ICON} /> New automation
        </Link>
      </PageHead>

      {automations.isError && <ErrorNotice error={automations.error} onRetry={automations.refetch} />}

      {list.length > 0 && (
        <div className="stat-strip card flush">
          {[
            ["Live", totals.live, "", true],
            ["Paused", totals.paused],
            ["DMs sent", totals.dms, "lead"],
            ["Failed", totals.failed, totals.failed ? "neg" : ""],
            ["Link clicks", totals.clicks],
            ["Unique people", totals.people],
          ].map(([l, v, cls, dot]) => (
            <div key={l} className={cls}>
              <span className="label">
                {dot && <span className="dot on" style={{ marginRight: 6 }} />}
                {l}
              </span>
              <span className="value">{num(v)}</span>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className="missing-row">
          <Zap {...ICON} className="muted" />
          <span className="secondary">
            {missing.length} {missing.length === 1 ? "caption asks" : "captions ask"} for a keyword with no automation
          </span>
          <span className="keys">
            {missing.slice(0, 3).map(({ keyword, post }) => (
              <Key sm key={post.id}>
                {keyword}
              </Key>
            ))}
            {missing.length > 3 && <span className="mono muted">+{missing.length - 3}</span>}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => setReviewOpen(true)}>
            Review
          </button>
        </div>
      )}

      {automations.isLoading ? (
        <Skeleton h={560} style={{ borderRadius: 14, marginTop: 16 }} />
      ) : list.length ? (
        <Board list={list} byPost={byPost} />
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <Empty title="No automations yet" actions={<Link className="btn sm" to="/automations/new">New automation</Link>}>
            Pick a reel, set the keyword its caption asks for, and write the DM
          </Empty>
        </div>
      )}

      <Workflows />

      {reviewOpen && (
        <Drawer title="Captions with no automation" onClose={() => setReviewOpen(false)}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            These captions ask people to comment a word, but nothing replies yet
          </p>
          {missing.map(({ post, keyword }) => (
            <div className="row" key={post.id}>
              <Thumb src={post.thumbnailUrl} />
              <div className="grow">
                <div className="ellipsis">{postTitle(post, 70)}</div>
                <div className="mono muted">
                  {dateShort(post.publishedAt)} · {num(post.metrics.comments)} comments
                </div>
              </div>
              <Key>{keyword}</Key>
              <Link className="btn sm" to={automateLink(post, keyword)}>
                <Zap size={14} strokeWidth={1.5} /> Create
              </Link>
            </div>
          ))}
        </Drawer>
      )}
    </div>
  );
}

function Board({ list, byPost }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("dms");
  const [checked, setChecked] = useState(() => new Set());
  const qc = useQueryClient();
  const toast = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);

  const counts = {
    all: list.length,
    live: list.filter((a) => a.active).length,
    paused: list.filter((a) => !a.active).length,
    attention: list.filter(needsAttention).length,
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((a) => (filter === "live" ? a.active : filter === "paused" ? !a.active : filter === "attention" ? needsAttention(a) : true))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.keywords.some((k) => k.toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [list, query, filter, sort]);

  const selectedId = params.get("id");
  const selected = shown.find((a) => a.id === selectedId) || shown[0] || null;
  const allChecked = shown.length > 0 && shown.every((a) => checked.has(a.id));

  const toggleCheck = (id) =>
    setChecked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const bulk = async (active) => {
    setBulkBusy(true);
    const ids = [...checked];
    const results = await Promise.allSettled(ids.map((id) => api.patch(`/automations/${id}`, { active })));
    const failed = results.filter((r) => r.status === "rejected").length;
    qc.invalidateQueries({ queryKey: ["automations"] });
    toast.show(
      failed ? `${ids.length - failed} updated, ${failed} failed` : `${ids.length} ${ids.length === 1 ? "automation" : "automations"} ${active ? "live" : "paused"}`,
      failed ? "error" : "ok",
    );
    setChecked(new Set());
    setBulkBusy(false);
  };

  return (
    <div className="auto-split">
      <div className="split-list">
        <div className="auto-toolbar">
          <div style={{ display: "flex", gap: 8 }}>
            <label className="search" style={{ flex: 1 }}>
              <Search {...ICON} />
              <span className="sr-only">Search</span>
              <input className="input" placeholder="Search name or keyword" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="sort-select">
              <ArrowDownWideNarrow size={14} strokeWidth={1.5} />
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="seg" role="group" aria-label="Filter">
            {[
              ["all", "All"],
              ["live", "Live"],
              ["paused", "Paused"],
              ["attention", "Needs attention"],
            ].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {l} <span className={`mono ${k === "attention" && counts.attention ? "negative" : "muted"}`} style={{ fontSize: 11 }}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {checked.size > 0 ? (
          <div className="auto-list-head bulk">
            <span>{checked.size} selected</span>
            <span style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => bulk(false)} disabled={bulkBusy}>
              <Pause size={14} strokeWidth={1.5} /> Pause
            </button>
            <button className="btn sm" onClick={() => bulk(true)} disabled={bulkBusy}>
              <Play size={14} strokeWidth={1.5} /> Resume
            </button>
            <button className="btn ghost sm icon" aria-label="Clear selection" onClick={() => setChecked(new Set())}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="auto-list-head">
            <input
              type="checkbox"
              className="box"
              aria-label="Select all"
              checked={allChecked}
              onChange={() => setChecked(allChecked ? new Set() : new Set(shown.map((a) => a.id)))}
            />
            <span style={{ flex: 1 }}>Automation</span>
            <span className="num-col">DMs</span>
            <span className="dot-col" />
          </div>
        )}

        <div className="scroll scrollbar">
          {shown.length ? (
            shown.map((a) => {
              const post = byPost.get(a.postId);
              const Icon = TRIGGER_ICON[a.trigger];
              return (
                <div key={a.id} className="auto-row" aria-current={a.id === selected?.id} onClick={() => setParams({ id: a.id })}>
                  <input
                    type="checkbox"
                    className="box"
                    aria-label={`Select ${a.name}`}
                    checked={checked.has(a.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleCheck(a.id)}
                  />
                  {Icon ? (
                    <span className="trigger-icon">
                      <Icon size={14} strokeWidth={1.5} />
                    </span>
                  ) : (
                    <Thumb src={post?.thumbnailUrl} />
                  )}
                  <div className="grow">
                    <div className="auto-row-name">
                      <span className="ellipsis">{a.name || "Untitled automation"}</span>
                      {needsAttention(a) && <span className="mono negative" style={{ fontSize: 11 }}>{num(a.stats.failed)} failed</span>}
                    </div>
                    <div className="auto-row-meta">
                      {a.keywords.slice(0, 1).map((k) => (
                        <Key sm key={k}>
                          {k}
                        </Key>
                      ))}
                      {a.keywords.length > 1 && <span className="mono muted">+{a.keywords.length - 1}</span>}
                      <span className="mono muted">{WHERE[a.trigger]}</span>
                    </div>
                  </div>
                  <span className="num-col num">{num(a.stats.dmsSent)}</span>
                  <span className="dot-col" title={a.active ? "Live" : "Paused"}>
                    <span className={`dot ${!a.active ? "" : needsAttention(a) ? "warn" : "on"}`} />
                  </span>
                </div>
              );
            })
          ) : (
            <Empty title="No automations match" />
          )}
        </div>
      </div>

      {selected ? <Detail key={selected.id} a={selected} post={byPost.get(selected.postId)} /> : <div className="split-main"><Empty title="Pick an automation" /></div>}
    </div>
  );
}

const STATUS_COLOR = { sent: "positive", failed: "negative" };
const STATUS_LABEL = { sent: "DM sent", failed: "Failed", skipped: "Skipped", pending: "Pending", gated: "Asked to follow" };

function Detail({ a, post }) {
  const [filter, setFilter] = useState("");
  const activity = useAutomationActivity(a.id, filter && filter !== "miss" ? filter : undefined);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const [ask, dialog] = useConfirm();
  const [, setParams] = useSearchParams();
  const invalidate = [["automations"]];
  const toggle = useAction((active) => api.patch(`/automations/${a.id}`, { active }), {
    success: (_d, on) => (on ? "Automation is live" : "Automation paused"),
    invalidate,
  });
  const remove = useAction(() => api.del(`/automations/${a.id}`), {
    success: "Automation deleted",
    invalidate,
    onSuccess: () => setParams({}),
  });

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const d = activity.data;
  const sample = d?.logs?.find((l) => l.status === "sent")?.person?.username;
  const rows =
    filter === "miss"
      ? (d?.misses?.samples || []).map((m, i) => ({ id: `m${i}`, who: m.username, text: m.text, at: m.at, label: "No match", cls: "muted" }))
      : [
          ...(d?.logs || []).map((l) => ({ id: l.id, who: l.person.username || l.person.name, text: l.text, at: l.createdAt, label: STATUS_LABEL[l.status] || l.status, cls: STATUS_COLOR[l.status], error: l.error })),
          ...(filter ? [] : (d?.misses?.samples || []).map((m, i) => ({ id: `m${i}`, who: m.username, text: m.text, at: m.at, label: "No match", cls: "muted" }))),
        ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const S = a.stats;
  const Icon = TRIGGER_ICON[a.trigger];

  return (
    <div className="split-main">
      {dialog}
      <div className="split-head">
        {Icon ? (
          <span className="trigger-icon lg">
            <Icon size={16} strokeWidth={1.5} />
          </span>
        ) : (
          <Thumb src={post?.thumbnailUrl} />
        )}
        <div className="grow" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <b className="ellipsis" style={{ fontSize: 16 }}>{a.name || "Untitled automation"}</b>
          <span className="status" style={{ flex: "none" }}>
            <span className={`dot ${a.active ? "on" : ""}`} />
            {a.active ? "Live" : "Paused"}
          </span>
        </div>
        <Switch checked={a.active} onChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} label={a.active ? "Pause" : "Go live"} />
        <Link className="btn sm" to={`/automations/${a.id}`}>
          <Pencil size={14} strokeWidth={1.5} /> Edit
        </Link>
        <div className="menu-wrap" ref={menuRef}>
          <button className="btn ghost sm icon" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Ellipsis size={14} strokeWidth={1.5} />
          </button>
          {menu && (
            <div className="menu" role="menu">
              {post?.url && (
                <a role="menuitem" href={post.url} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={14} strokeWidth={1.5} /> Open post
                </a>
              )}
              <button
                role="menuitem"
                className="negative"
                onClick={async () => {
                  setMenu(false);
                  (await ask({
                    title: "Delete this automation?",
                    body: "New comments will no longer get a DM. Messages already sent stay in the inbox.",
                    confirmLabel: "Delete",
                    danger: true,
                  })) && remove.mutate();
                }}
              >
                <Trash2 size={14} strokeWidth={1.5} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flow">
        <div className="flow-step">
          <span className="mono muted">1&nbsp;&nbsp;{a.trigger === "comment" ? "Comment" : WHERE[a.trigger]}</span>
          <span className="chip">
            <span>{sample || "someone"}</span>
            {a.keywords.slice(0, 2).map((k) => (
              <Key lit key={k}>
                {k}
              </Key>
            ))}
            {!a.keywords.length && <span className="muted">anything</span>}
          </span>
        </div>
        {a.trigger === "comment" && (
          <>
            <ArrowRight {...ICON} className="flow-arrow" />
            <div className="flow-step">
              <span className="mono muted">2&nbsp;&nbsp;Public reply</span>
              {a.commentReply ? <span className="chip">{a.commentReply}</span> : <span className="muted">No public reply</span>}
            </div>
          </>
        )}
        <ArrowRight {...ICON} className="flow-arrow" />
        <div className="flow-step">
          <span className="mono muted">{a.trigger === "comment" ? 3 : 2}&nbsp;&nbsp;Direct message</span>
          <div className="bubble">{a.dmMessage}</div>
        </div>
      </div>

      <div className="stat-strip" style={{ borderBottom: "1px solid var(--line)" }}>
        {[
          ["Triggered", S.triggered],
          ["DMs sent", S.dmsSent, "lead"],
          ["Failed", S.failed, S.failed ? "neg" : ""],
          ["Skipped", S.skipped],
          ["Link clicks", S.linkClicks],
          ["People", S.people],
        ].map(([l, v, cls]) => (
          <div key={l} className={cls}>
            <span className="label">{l}</span>
            <span className="value">{num(v)}</span>
          </div>
        ))}
      </div>

      <div className="activity-head">
        <h2>Recent activity</h2>
        <Segmented
          value={filter}
          onChange={setFilter}
          label="Activity filter"
          options={[
            { value: "", label: "All" },
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "miss", label: "No match" },
          ]}
        />
      </div>
      <div className="scroll scrollbar activity-list">
        {activity.isLoading ? (
          <Skeleton h={200} />
        ) : activity.isError ? (
          <ErrorNotice error={activity.error} onRetry={activity.refetch} />
        ) : rows.length ? (
          rows.map((r) => (
            <div className="row" key={r.id}>
              <div className="grow">
                <div className="ellipsis" style={{ fontWeight: 500 }}>
                  {r.who || "Instagram user"}
                </div>
                <div className="ellipsis secondary" style={{ fontSize: 13 }}>
                  "{r.text}"
                </div>
                {r.error && <div className="negative" style={{ fontSize: 13 }}>{r.error}</div>}
              </div>
              <div className="figure-r">
                <span className={`mono ${r.cls || ""}`}>{r.label}</span>
                <span className="mono muted">{Date.now() - Date.parse(r.at) < 86400_000 ? timeOnly(r.at) : ago(r.at)}</span>
              </div>
            </div>
          ))
        ) : (
          <Empty title={filter === "miss" ? "No unmatched comments" : "Nothing here yet"} />
        )}
      </div>
    </div>
  );
}

function Workflows() {
  const { dashboardUrl } = useAccount();
  const workflows = useWorkflows();
  const list = workflows.data || [];
  const toggle = useAction(({ id, active }) => api.post(`/workflows/${id}/active`, { active }), {
    success: (_d, v) => (v.active ? "Workflow resumed" : "Workflow paused"),
    invalidate: [["workflows"]],
  });

  if (workflows.isError) return null;
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {list.length ? (
        list.map((w) => (
          <div className="workflow-strip" key={w.id}>
            <Workflow {...ICON} className="muted" />
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{w.name}</div>
              <div className="mono muted">
                {w.status} · {num(w.started)} started · {num(w.completed)} completed
              </div>
            </div>
            {w.status !== "draft" && (
              <button className="btn sm" onClick={() => toggle.mutate({ id: w.id, active: w.status !== "active" })}>
                {w.status === "active" ? <Pause size={14} strokeWidth={1.5} /> : <Play size={14} strokeWidth={1.5} />}
                {w.status === "active" ? "Pause" : "Resume"}
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="workflow-strip">
          <Workflow {...ICON} className="muted" />
          <div className="grow">
            <div style={{ fontWeight: 500 }}>Workflows</div>
            <div className="muted" style={{ fontSize: 13 }}>
              No multi-step workflows yet. Build them in the dashboard and they show up here to pause or resume
            </div>
          </div>
          {dashboardUrl && (
            <a className="btn ghost sm" href={dashboardUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight size={14} strokeWidth={1.5} /> Open dashboard
            </a>
          )}
        </div>
      )}
    </div>
  );
}
