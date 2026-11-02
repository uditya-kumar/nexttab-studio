import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowUpRight, Search, Send } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAction, useAutomations, useConversations, useMessages } from "../lib/queries.js";
import { ago, dateTime, timeOnly } from "../lib/format.js";
import { Avatar, Empty, ErrorNotice, ICON, Key, PageHead, Segmented, Skeleton, Spinner } from "../components/ui.jsx";

export default function Inbox() {
  const { accountId } = useAccount();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const convos = useConversations(accountId, status);
  const all = useMemo(() => (convos.data?.pages || []).flatMap((p) => p.items), [convos.data]);
  const list = all.filter((c) => !search || `${c.name} ${c.username || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectedId = params.get("c") || list[0]?.id || null;
  const selected = all.find((c) => c.id === selectedId) || null;

  return (
    <div className="page">
      <PageHead title="Messages" sub="Instagram DMs to @nexttab, including the ones your automations send">
        <Segmented
          value={status}
          onChange={(v) => {
            setStatus(v);
            setParams({});
          }}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ]}
          label="Folder"
        />
      </PageHead>

      {convos.isError ? (
        <ErrorNotice error={convos.error} onRetry={convos.refetch} />
      ) : (
        <div className="split">
          <div className="split-list">
            <div className="split-search">
              <label className="search">
                <Search {...ICON} />
                <span className="sr-only">Search</span>
                <input className="input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
            <div className="scroll">
              {convos.isLoading ? (
                <div style={{ padding: 16 }}>
                  <Skeleton h={200} />
                </div>
              ) : list.length ? (
                list.map((c) => (
                  <button
                    key={c.id}
                    className="list-item"
                    aria-current={c.id === selectedId}
                    onClick={() => setParams({ c: c.id })}
                  >
                    <Avatar src={c.avatarUrl} name={c.name} />
                    <span className="grow">
                      <span className="top">
                        <b className="ellipsis">{c.name}</b>
                        <span className="mono muted">{ago(c.updatedAt)}</span>
                      </span>
                      <span className="preview ellipsis">{c.lastMessage}</span>
                    </span>
                    {c.unread > 0 && <span className="dot on" title={`${c.unread} unread`} />}
                  </button>
                ))
              ) : (
                <Empty title={search ? "No matches" : status === "archived" ? "Nothing archived" : "No conversations yet"} />
              )}
              {convos.hasNextPage && (
                <div style={{ padding: 12 }}>
                  <button className="btn ghost sm" style={{ width: "100%" }} onClick={() => convos.fetchNextPage()} disabled={convos.isFetchingNextPage}>
                    {convos.isFetchingNextPage ? <Spinner size={14} /> : "Load older conversations"}
                  </button>
                </div>
              )}
            </div>
          </div>
          {selected ? <Thread conversation={selected} /> : <div className="split-main"><Empty title="Pick a conversation" /></div>}
        </div>
      )}
    </div>
  );
}

function Thread({ conversation: c }) {
  const { accountId } = useAccount();
  const messages = useMessages(c.id, accountId);
  const automations = useAutomations();
  const [text, setText] = useState("");
  const bottom = useRef(null);
  const list = messages.data || [];
  const byId = new Map((automations.data || []).map((a) => [a.id, a]));
  const firstAuto = list.find((m) => m.via === "automation" && m.automationId);
  const source = firstAuto ? byId.get(firstAuto.automationId) : null;

  const send = useAction((body) => api.post(`/conversations/${encodeURIComponent(c.id)}/messages`, body), {
    invalidate: [["messages", c.id], ["conversations"]],
    onSuccess: () => setText(""),
  });
  const archive = useAction(
    (status) => api.patch(`/conversations/${encodeURIComponent(c.id)}`, { accountId, status }),
    { success: (_d, s) => (s === "archived" ? "Conversation archived" : "Moved back to active"), invalidate: [["conversations"]] },
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [list.length, c.id]);

  return (
    <div className="split-main">
      <div className="split-head">
        <Avatar src={c.avatarUrl} name={c.name} />
        <div className="grow">
          <b className="ellipsis">{c.name}</b>
          <span className="mono muted ellipsis">
            {source ? `Came from a ${source.keywords[0] || "keyword"} comment${source.postTitle ? ` on ${source.postTitle}` : ""}` : c.username ? `@${c.username}` : "Instagram"}
          </span>
        </div>
        {c.url && (
          <a className="btn ghost sm" href={c.url} target="_blank" rel="noreferrer">
            <ArrowUpRight size={14} strokeWidth={1.5} /> Instagram
          </a>
        )}
        <button className="btn sm" onClick={() => archive.mutate(c.status === "archived" ? "active" : "archived")} disabled={archive.isPending}>
          {c.status === "archived" ? <ArchiveRestore size={14} strokeWidth={1.5} /> : <Archive size={14} strokeWidth={1.5} />}
          {c.status === "archived" ? "Unarchive" : "Archive"}
        </button>
      </div>

      <div className="scroll">
        <div className="thread">
          {messages.isLoading ? (
            <Skeleton h={160} />
          ) : messages.isError ? (
            <ErrorNotice error={messages.error} onRetry={messages.refetch} />
          ) : (
            list.map((m) => (
              <Message key={m.id} m={m} source={m === firstAuto ? byId.get(m.automationId) : null} />
            ))
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="composer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate({ accountId, text: text.trim() });
          }}
        >
          <input className="input" placeholder="Write a reply" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
          <button className="btn primary" disabled={!text.trim() || send.isPending}>
            {send.isPending ? <Spinner size={14} /> : <Send {...ICON} />} Send
          </button>
        </form>
        <span className="hint" style={{ fontSize: 12, color: "var(--text-3)" }}>
          Instagram only lets you reply within 24 hours of their last message
        </span>
      </div>
    </div>
  );
}

function Message({ m, source }) {
  const out = m.direction === "outgoing";
  return (
    <>
      {source && (
        <div className="event">
          {dateTime(m.createdAt)} · commented
          {source.keywords.slice(0, 1).map((k) => (
            <Key sm lit key={k}>
              {k}
            </Key>
          ))}
        </div>
      )}
      <div className={`msg ${out ? "out" : "in"}`}>
        {m.isStoryReply && <span className="mono muted">Replied to your story</span>}
        {(m.text || !m.attachments.length) && <div className="bubble">{m.text || "Unsupported message"}</div>}
        {m.attachments.map((a, i) =>
          a.url ? (
            <a key={i} className="btn sm" href={a.url} target="_blank" rel="noreferrer">
              {a.type} attachment <ArrowUpRight size={14} strokeWidth={1.5} />
            </a>
          ) : null,
        )}
        <div className="meta">
          {m.via === "automation" && <span className="via">Sent by automation</span>}
          <span>
            {timeOnly(m.createdAt)}
            {out && m.status ? ` · ${m.status}` : ""}
          </span>
        </div>
      </div>
    </>
  );
}
