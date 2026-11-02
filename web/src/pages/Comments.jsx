import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Eye, EyeOff, MessageSquare, Reply, Send, Trash2 } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAction, useAutomationActivity, useAutomations, useCommentedPosts, useComments } from "../lib/queries.js";
import { dateShort, num, timeOnly, ago } from "../lib/format.js";
import { matchesKeyword, postTitle } from "../lib/posts.js";
import { Avatar, Empty, ErrorNotice, Key, PageHead, Skeleton, Spinner, Thumb, useConfirm } from "../components/ui.jsx";

export default function Comments() {
  const { accountId } = useAccount();
  const [params, setParams] = useSearchParams();
  const posts = useCommentedPosts(accountId);
  const list = useMemo(() => (posts.data?.pages || []).flatMap((p) => p.items), [posts.data]);
  const selectedId = params.get("post") || list[0]?.id || null;
  const selected = list.find((p) => p.id === selectedId) || (selectedId ? { id: selectedId, caption: "", commentCount: null } : null);

  return (
    <div className="page">
      <PageHead
        title="Comments"
        sub="Reply, hide or DM commenters. Keyword matches are marked so you can see what your automations caught"
      />
      {posts.isError ? (
        <ErrorNotice error={posts.error} onRetry={posts.refetch} />
      ) : (
        <div className="split">
          <div className="split-list">
            <div className="scroll">
              {posts.isLoading ? (
                <div style={{ padding: 16 }}>
                  <Skeleton h={240} />
                </div>
              ) : list.length ? (
                list.map((p) => (
                  <button key={p.id} className="list-item" aria-current={p.id === selectedId} onClick={() => setParams({ post: p.id })}>
                    <Thumb src={p.thumbnailUrl} />
                    <span className="grow">
                      <span className="ellipsis" style={{ fontSize: 13 }}>
                        {postTitle(p, 60)}
                      </span>
                      <span className="mono muted">{dateShort(p.createdAt)}</span>
                    </span>
                    <span className="count">
                      <MessageSquare size={12} strokeWidth={1.5} /> {num(p.commentCount)}
                    </span>
                  </button>
                ))
              ) : (
                <Empty title="No comments yet" />
              )}
              {posts.hasNextPage && (
                <div style={{ padding: 12 }}>
                  <button className="btn ghost sm" style={{ width: "100%" }} onClick={() => posts.fetchNextPage()} disabled={posts.isFetchingNextPage}>
                    {posts.isFetchingNextPage ? <Spinner size={14} /> : "Load older posts"}
                  </button>
                </div>
              )}
            </div>
          </div>
          {selected ? <Thread post={selected} /> : <div className="split-main"><Empty title="Pick a post" /></div>}
        </div>
      )}
    </div>
  );
}

function Thread({ post }) {
  const { accountId } = useAccount();
  const comments = useComments(post.id, accountId);
  const automations = useAutomations();
  const automation =
    (automations.data || []).find((a) => a.postId === post.id) ||
    (automations.data || []).find((a) => a.active && !a.postId && a.trigger === "comment") ||
    null;
  const activity = useAutomationActivity(automation?.id);
  const sentFor = new Set((activity.data?.logs || []).filter((l) => l.status === "sent").map((l) => l.commentId));

  const pages = comments.data?.pages || [];
  const info = pages[0]?.post;
  const list = pages.flatMap((p) => p.items);
  const [open, setOpen] = useState(null);

  return (
    <div className="split-main">
      <div className="split-head">
        <Thumb src={info?.thumbnailUrl || post.thumbnailUrl} />
        <div className="grow">
          <b className="ellipsis">{postTitle(info || post, 90)}</b>
          <span className="mono muted">
            {dateShort(info?.createdAt || post.createdAt)}
            {post.commentCount !== null && post.commentCount !== undefined ? ` · ${num(post.commentCount)} comments` : ""}
          </span>
        </div>
        {(info?.url || post.url) && (
          <a className="btn ghost sm" href={info?.url || post.url} target="_blank" rel="noreferrer">
            <ArrowUpRight size={14} strokeWidth={1.5} /> Instagram
          </a>
        )}
      </div>

      {automation && (
        <div className="banner">
          <span className={`dot ${automation.active ? "on" : ""}`} />
          <span>{automation.active ? "Automation live on this post. Comments with" : "Automation paused on this post. Comments with"}</span>
          <span className="keys">
            {automation.keywords.map((k) => (
              <Key sm lit={automation.active} key={k}>
                {k}
              </Key>
            ))}
          </span>
          <span className="grow">get the link by DM</span>
          <Link className="btn ghost sm" to={`/automations/${automation.id}`}>
            Edit automation
          </Link>
        </div>
      )}

      <div className="scroll" style={{ padding: "4px 20px" }}>
        {comments.isLoading ? (
          <div style={{ paddingTop: 16 }}>
            <Skeleton h={240} />
          </div>
        ) : comments.isError ? (
          <div style={{ paddingTop: 16 }}>
            <ErrorNotice error={comments.error} onRetry={comments.refetch} />
          </div>
        ) : list.length ? (
          list.map((c) => (
            <CommentRow
              key={c.id}
              c={c}
              postId={post.id}
              automation={automation}
              dmSent={sentFor.has(c.id)}
              open={open}
              setOpen={setOpen}
            />
          ))
        ) : (
          <Empty title="No comments on this post" />
        )}
        {comments.hasNextPage && (
          <div style={{ padding: "12px 0" }}>
            <button className="btn ghost sm" onClick={() => comments.fetchNextPage()} disabled={comments.isFetchingNextPage}>
              {comments.isFetchingNextPage ? <Spinner size={14} /> : "Load older comments"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentRow({ c, postId, automation, dmSent, open, setOpen }) {
  const { accountId } = useAccount();
  const [text, setText] = useState("");
  const [ask, dialog] = useConfirm();
  const mode = open?.id === c.id ? open.mode : null;
  const matched = automation && !c.author.isOwner ? matchesKeyword(c.text, automation.keywords, automation.matchMode) : null;
  const invalidate = [["comments", postId]];
  const close = () => {
    setOpen(null);
    setText("");
  };

  const reply = useAction((t) => api.post("/comments/reply", { postId, accountId, commentId: c.id, text: t }), {
    success: "Reply posted",
    invalidate,
    onSuccess: close,
  });
  const dm = useAction((t) => api.post("/comments/dm", { postId, accountId, commentId: c.id, text: t }), {
    success: `DM sent to ${c.author.username}`,
    onSuccess: close,
  });
  const hide = useAction((hidden) => api.post("/comments/hidden", { postId, accountId, commentId: c.id, hidden }), {
    success: (_d, h) => (h ? "Comment hidden" : "Comment visible again"),
    invalidate,
  });
  const remove = useAction(() => api.del("/comments", { postId, accountId, commentId: c.id }), { success: "Comment deleted", invalidate });

  const start = (m) => {
    setOpen({ id: c.id, mode: m });
    setText(m === "reply" ? `@${c.author.username} ` : "");
  };
  const busy = reply.isPending || dm.isPending;

  return (
    <div className={`comment ${mode ? "open" : ""}`}>
      {dialog}
      {c.author.isOwner ? (
        <span className="avatar owner-avatar">{c.author.username.slice(0, 2).toUpperCase()}</span>
      ) : (
        <Avatar src={c.author.avatarUrl} name={c.author.username} />
      )}
      <div className="body">
        <div className="top">
          <b>{c.author.username}</b>
          <span className="mono muted" title={c.createdAt}>
            {Date.now() - Date.parse(c.createdAt) < 86400_000 ? timeOnly(c.createdAt) : ago(c.createdAt)}
          </span>
          {c.author.isOwner && <span className="mono muted">you</span>}
          {matched && (
            <>
              <span className="mono muted">matched</span>
              <Key sm lit>
                {matched}
              </Key>
              {dmSent && <span className="mono positive">DM sent</span>}
            </>
          )}
          {automation && !matched && !c.author.isOwner && <span className="mono muted">no keyword match</span>}
          {c.hidden && <span className="tag">Hidden</span>}
        </div>
        <div className={`text ${c.hidden ? "hidden" : ""}`}>{c.text}</div>
        <div className="actions">
          {c.author.isOwner ? (
            c.can.delete && (
              <button
                className="btn ghost sm icon-danger"
                onClick={async () =>
                  (await ask({ title: "Delete your comment?", confirmLabel: "Delete", danger: true })) && remove.mutate()
                }
              >
                <Trash2 size={13} strokeWidth={1.5} /> Delete
              </button>
            )
          ) : (
            <>
              {c.can.reply && (
                <button className="btn ghost sm" onClick={() => start("reply")}>
                  <Reply size={13} strokeWidth={1.5} /> Reply
                </button>
              )}
              <button className="btn ghost sm" onClick={() => start("dm")}>
                <Send size={13} strokeWidth={1.5} /> Send DM
              </button>
              {c.can.hide && (
                <button className="btn ghost sm" onClick={() => hide.mutate(!c.hidden)} disabled={hide.isPending}>
                  {c.hidden ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />} {c.hidden ? "Unhide" : "Hide"}
                </button>
              )}
            </>
          )}
        </div>
        {mode && (
          <form
            className="reply-box"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              (mode === "reply" ? reply : dm).mutate(text.trim());
            }}
          >
            <input
              className="input"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "dm" ? `Private message to ${c.author.username}` : "Write a public reply"}
              onKeyDown={(e) => e.key === "Escape" && close()}
            />
            <button className="btn primary" disabled={!text.trim() || busy}>
              {busy && <Spinner size={14} />}
              {mode === "dm" ? "Send DM" : "Reply"}
            </button>
          </form>
        )}
        {mode === "dm" && <span className="hint" style={{ fontSize: 12, color: "var(--text-3)" }}>Instagram allows one private reply per comment, within 7 days</span>}
        {c.replies.length > 0 && (
          <div className="replies">
            {c.replies.map((r) => (
              <div key={r.id} style={{ fontSize: 13 }}>
                <b style={{ fontWeight: 500 }}>{r.author.username}</b> <span className="secondary">{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
