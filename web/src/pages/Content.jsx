import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MessageSquare, Pencil, Play, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAction, useAutomations, usePublished, useQueued } from "../lib/queries.js";
import { dateShort, dateTime, num, short } from "../lib/format.js";
import { KIND_LABEL, automateLink, captionKeyword, postTitle } from "../lib/posts.js";
import { Empty, ErrorNotice, ICON, Key, PageHead, Skeleton, Thumb, useConfirm } from "../components/ui.jsx";

const TABS = [
  { id: "published", label: "Published" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Drafts" },
  { id: "failed", label: "Failed" },
];

export default function Content() {
  const { accountId } = useAccount();
  const [tab, setTab] = useState("published");
  const published = usePublished(accountId, { limit: 1 });
  const scheduled = useQueued(accountId, "scheduled");
  const drafts = useQueued(accountId, "draft");
  const failed = useQueued(accountId, "failed");
  const counts = {
    published: published.data?.total,
    scheduled: scheduled.data?.length,
    draft: drafts.data?.length,
    failed: failed.data?.length,
  };

  return (
    <div className="page">
      <PageHead title="Content" sub="Everything on @nexttab, and what is queued to go out">
        <Link to="/compose" className="btn accent">
          <Plus {...ICON} /> New post
        </Link>
      </PageHead>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] !== undefined && <span className="count">{num(counts[t.id])}</span>}
          </button>
        ))}
      </div>
      {tab === "published" ? <Published /> : <Queue status={tab} />}
    </div>
  );
}

function Published() {
  const { accountId } = useAccount();
  const [page, setPage] = useState(1);
  const posts = usePublished(accountId, { sort: "date", limit: 20, page });
  const automations = useAutomations();
  const byPost = new Map((automations.data || []).filter((a) => a.postId).map((a) => [a.postId, a]));
  const list = posts.data?.posts || [];
  const pages = posts.data?.pages || 1;

  if (posts.isError) return <ErrorNotice error={posts.error} onRetry={posts.refetch} />;
  if (posts.isLoading)
    return (
      <div className="cover-grid">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} h={480} style={{ borderRadius: 14 }} />
        ))}
      </div>
    );
  if (!list.length) return <Empty title="No published posts in the last 90 days" />;

  return (
    <>
      <div className="cover-grid">
        {list.map((post) => {
          const automation = byPost.get(post.platformPostId);
          const keyword = captionKeyword(post.caption);
          return (
            <article className="cover-card" key={post.id}>
              <a className="cover" href={post.url || undefined} target="_blank" rel="noreferrer" aria-label="Open on Instagram">
                {post.thumbnailUrl && <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                <span className="cover-kind mono">{KIND_LABEL[post.kind]}</span>
              </a>
              <div className="cover-body">
                <p className="cover-title clamp-2">{postTitle(post, 120)}</p>
                <span className="cover-meta mono">
                  {dateShort(post.publishedAt)} · {short(post.metrics.views)} views
                </span>
                <div className="cover-foot">
                  {automation ? (
                    <Link to="/automations" className="status" title="A comment automation runs on this post">
                      <span className={`dot ${automation.active ? "on" : ""}`} />
                      {automation.keywords.slice(0, 1).map((k) => (
                        <Key sm lit={automation.active} key={k}>
                          {k}
                        </Key>
                      ))}
                      <span className="mono muted">{num(automation.stats.dmsSent)} DMs</span>
                    </Link>
                  ) : post.platformPostId ? (
                    <Link className="btn sm" to={automateLink(post, keyword)}>
                      <Zap size={14} strokeWidth={1.5} /> Automate{keyword ? ` ${keyword}` : ""}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {post.platformPostId && (
                    <Link
                      className="btn ghost sm icon"
                      to={`/comments?post=${post.platformPostId}`}
                      aria-label={`${num(post.metrics.comments)} comments`}
                      title={`${num(post.metrics.comments)} comments`}
                    >
                      <MessageSquare size={14} strokeWidth={1.5} />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="pager">
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </button>
          <span className="mono muted">
            Page {page} of {pages}
          </span>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Older
          </button>
        </div>
      )}
    </>
  );
}

const EMPTY = {
  scheduled: ["Nothing scheduled", "Schedule a reel from New post and it waits here until it goes live"],
  draft: ["No drafts", "Save a post as a draft to finish it later"],
  failed: ["No failed posts", "If Instagram rejects a post, it lands here with the reason and a retry button"],
};

function Queue({ status }) {
  const { accountId } = useAccount();
  const posts = useQueued(accountId, status);
  const [ask, dialog] = useConfirm();
  const invalidate = [["posts"]];
  const remove = useAction((id) => api.del(`/posts/${id}`), { success: "Post deleted", invalidate });
  const retry = useAction((id) => api.post(`/posts/${id}/retry`), { success: "Retry started", invalidate });
  const publish = useAction((id) => api.post(`/posts/${id}/publish`), { success: "Publishing now", invalidate });

  if (posts.isError) return <ErrorNotice error={posts.error} onRetry={posts.refetch} />;
  if (posts.isLoading) return <Skeleton h={200} />;
  const list = posts.data || [];
  if (!list.length)
    return (
      <div className="card">
        <Empty title={EMPTY[status][0]} actions={status !== "failed" && <Link className="btn sm" to="/compose">New post</Link>}>
          {EMPTY[status][1]}
        </Empty>
      </div>
    );

  return (
    <div className="card flush">
      {dialog}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Post</th>
              <th>{status === "scheduled" ? "Goes live" : "Updated"}</th>
              <th>Status</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((post) => {
              const media = post.media[0];
              return (
                <tr key={post.id}>
                  <td>
                    <div className="post-cell">
                      <Thumb src={media?.thumbnail || (media?.type === "image" ? media.url : null)} />
                      <div className="text">
                        <span className="title">{postTitle(post)}</span>
                        {post.error && <span className="negative" style={{ fontSize: 13 }}>{post.error}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="mono secondary">{dateTime(status === "scheduled" ? post.scheduledFor : post.updatedAt)}</td>
                  <td>
                    <span className="tag">{post.status}</span>
                  </td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      {status !== "failed" && (
                        <Link className="btn ghost sm" to={`/compose/${post.id}`}>
                          <Pencil size={14} strokeWidth={1.5} /> Edit
                        </Link>
                      )}
                      {status === "scheduled" && (
                        <button
                          className="btn ghost sm"
                          onClick={async () =>
                            (await ask({
                              title: "Publish this post now?",
                              body: "It goes live on Instagram right away instead of at its scheduled time.",
                              confirmLabel: "Publish now",
                            })) && publish.mutate(post.id)
                          }
                        >
                          <Play size={14} strokeWidth={1.5} /> Publish now
                        </button>
                      )}
                      {status === "failed" && (
                        <button className="btn ghost sm" onClick={() => retry.mutate(post.id)}>
                          <RotateCcw size={14} strokeWidth={1.5} /> Retry
                        </button>
                      )}
                      {post.url && (
                        <a className="btn ghost sm icon" href={post.url} target="_blank" rel="noreferrer" aria-label="Open">
                          <ArrowUpRight size={14} strokeWidth={1.5} />
                        </a>
                      )}
                      <button
                        className="btn ghost sm icon icon-danger"
                        aria-label="Delete"
                        onClick={async () =>
                          (await ask({
                            title: "Delete this post?",
                            body: "It is removed and will not be published.",
                            confirmLabel: "Delete",
                            danger: true,
                          })) && remove.mutate(post.id)
                        }
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
