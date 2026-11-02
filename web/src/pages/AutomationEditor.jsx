import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAutomation, usePublished } from "../lib/queries.js";
import { dateShort, num } from "../lib/format.js";
import { KIND_LABEL, captionKeyword, postTitle } from "../lib/posts.js";
import { useToast } from "../components/Toast.jsx";
import { Drawer, ErrorNotice, ICON, Key, PageHead, Segmented, Skeleton, Spinner, Thumb } from "../components/ui.jsx";

const BLANK = {
  name: "",
  trigger: "comment",
  postId: null,
  postTitle: null,
  keywords: [],
  matchMode: "word",
  excludeKeywords: [],
  typoTolerance: true,
  dmMessage: "",
  button: { title: "Open on GitHub", url: "" },
  linkTracking: true,
  dmDelaySeconds: 0,
  commentReply: "Check your DM",
  replyPolicy: "after_dm",
  audience: "any",
  followGate: false,
  oncePerPerson: true,
  likeComment: true,
  hideComment: false,
  active: true,
};

const TRIGGERS = [
  { value: "comment", label: "Comments on a post" },
  { value: "story_reply", label: "Replies to a story" },
  { value: "story_mention", label: "Mentions you in a story" },
  { value: "live_comment", label: "Comments on a live" },
];

const DELAYS = [
  { value: 0, label: "Right away" },
  { value: 30, label: "30 seconds" },
  { value: 120, label: "2 minutes" },
];

export default function AutomationEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = useAutomation(id);
  const { account, accountId, profileId } = useAccount();
  const published = usePublished(accountId, { limit: 50 });
  const posts = published.data?.posts || [];
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState(null);
  const [kw, setKw] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Start from the existing automation, or from the post and keyword passed in the URL.
  useEffect(() => {
    if (form) return;
    if (id) {
      if (existing.data) setForm({ ...BLANK, ...existing.data, button: existing.data.button || { title: "Open on GitHub", url: "" } });
      return;
    }
    const keyword = params.get("keyword");
    const title = params.get("title");
    setForm({
      ...BLANK,
      postId: params.get("post"),
      postTitle: title,
      keywords: keyword ? [keyword.toUpperCase()] : [],
      name: keyword ? `${keyword.toUpperCase()} repo link` : "",
    });
  }, [id, existing.data, params, form]);

  if (id && existing.isLoading) return <div className="page"><Skeleton h={400} /></div>;
  if (id && existing.isError) return <div className="page"><ErrorNotice error={existing.error} onRetry={existing.refetch} /></div>;
  if (!form) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const post = posts.find((p) => p.platformPostId === form.postId) || null;
  const captionKw = captionKeyword(post?.caption);

  const addKeyword = (raw) => {
    const words = raw.split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length) set({ keywords: [...new Set([...form.keywords, ...words])] });
    setKw("");
  };

  const problems = [];
  if (!form.name.trim()) problems.push("Give it a name");
  if (form.trigger === "comment" && !form.postId) problems.push("Pick the post");
  if (form.trigger === "comment" && !form.keywords.length) problems.push("Add at least one keyword so it does not answer every comment");
  if (!form.dmMessage.trim()) problems.push("Write the DM");
  if (form.button?.url && !/^https?:\/\//.test(form.button.url)) problems.push("The button link must start with https://");

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      accountId,
      excludeKeywords: form.excludeKeywords,
      button: form.button?.url ? form.button : null,
      postId: form.trigger === "comment" ? form.postId : null,
      postTitle: form.trigger === "comment" ? form.postTitle || (post ? postTitle(post, 60) : null) : null,
    };
    try {
      if (id) await api.patch(`/automations/${id}`, body);
      else await api.post(`/automations?profileId=${encodeURIComponent(profileId || "")}`, body);
      qc.invalidateQueries({ queryKey: ["automations"] });
      qc.invalidateQueries({ queryKey: ["automation", id] });
      toast.show(id ? "Automation saved" : form.active ? "Automation is live" : "Automation saved, paused");
      navigate("/automations");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="crumb">
        <Link to="/automations">Automations</Link>
        <ChevronRight size={14} strokeWidth={1.5} />
      </div>
      <PageHead title={id ? "Edit automation" : "New automation"}>
        <Link to="/automations" className="btn ghost">
          Cancel
        </Link>
        <button className="btn accent" onClick={save} disabled={busy || problems.length > 0} title={problems[0]}>
          {busy ? <Spinner size={14} /> : <Check {...ICON} />}
          {id ? "Save" : form.active ? "Save and go live" : "Save paused"}
        </button>
      </PageHead>

      <div className="editor">
        <div className="editor-form">
          <section className="card">
            <h2>Trigger</h2>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="field">
              <span className="label">Start when someone</span>
              <div>
                <Segmented value={form.trigger} onChange={(v) => set({ trigger: v })} options={TRIGGERS} label="Trigger" />
              </div>
            </div>
            {form.trigger === "comment" && (
              <div className="field">
                <span className="label">Post</span>
                <div className="post-picker">
                  <Thumb src={post?.thumbnailUrl} />
                  <div className="grow">
                    <span className="ellipsis">{post ? postTitle(post, 90) : form.postTitle || "No post picked"}</span>
                    {post && (
                      <span className="mono muted">
                        {KIND_LABEL[post.kind]} · {dateShort(post.publishedAt)} · {num(post.metrics.comments)} comments
                      </span>
                    )}
                  </div>
                  <button className="btn sm" onClick={() => setPicking(true)}>
                    {form.postId ? "Change" : "Pick a post"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <div className="section-title">
              <h2>Keywords</h2>
              {captionKw && <p>The caption says Comment "{captionKw}"{form.keywords.includes(captionKw.toUpperCase()) || form.keywords.includes(captionKw) ? ", so that is filled in" : ""}</p>}
            </div>
            <label className="keyword-input">
              <span className="sr-only">Keywords</span>
              {form.keywords.map((k) => (
                <Key lit key={k} onRemove={() => set({ keywords: form.keywords.filter((x) => x !== k) })}>
                  {k}
                </Key>
              ))}
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addKeyword(kw);
                  } else if (e.key === "Backspace" && !kw && form.keywords.length) set({ keywords: form.keywords.slice(0, -1) });
                }}
                onBlur={() => kw && addKeyword(kw)}
                placeholder={form.keywords.length ? "Add another" : "Type a keyword and press Enter"}
              />
            </label>
            <div className="form-grid">
              <div className="field">
                <span className="label">Match</span>
                <div>
                  <Segmented
                    value={form.matchMode}
                    onChange={(v) => set({ matchMode: v })}
                    label="Match"
                    options={[
                      { value: "word", label: "Whole word" },
                      { value: "exact", label: "Exact comment" },
                      { value: "contains", label: "Anywhere" },
                    ]}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="exclude">Ignore comments containing</label>
                <input
                  id="exclude"
                  className="input"
                  value={form.excludeKeywords.join(", ")}
                  onChange={(e) => set({ excludeKeywords: e.target.value.split(",").map((w) => w.trim()).filter(Boolean) })}
                />
                <span className="hint">Comma separated</span>
              </div>
            </div>
            <Check2 checked={form.typoTolerance} onChange={(v) => set({ typoTolerance: v })} label="Forgive small typos" hint="Near misses of the keyword still count" />
          </section>

          <section className="card">
            <h2>Direct message</h2>
            <div className="field">
              <label htmlFor="dm">Message</label>
              <textarea id="dm" className="textarea" rows={3} value={form.dmMessage} onChange={(e) => set({ dmMessage: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="btn-title">Button label</label>
                <input id="btn-title" className="input" value={form.button?.title || ""} onChange={(e) => set({ button: { ...form.button, title: e.target.value } })} />
              </div>
              <div className="field">
                <label htmlFor="btn-url">Button link</label>
                <input
                  id="btn-url"
                  className="input"
                  placeholder="https://github.com/…"
                  value={form.button?.url || ""}
                  onChange={(e) => set({ button: { ...form.button, url: e.target.value } })}
                />
                <span className="hint">Leave empty to send the message without a button</span>
              </div>
              <Check2 checked={form.linkTracking} onChange={(v) => set({ linkTracking: v })} label="Count link clicks" hint="Wraps the link so clicks show up in stats" />
              <div className="field">
                <span className="label">Send after</span>
                <div>
                  <Segmented value={form.dmDelaySeconds} onChange={(v) => set({ dmDelaySeconds: v })} options={DELAYS} label="Delay" />
                </div>
              </div>
            </div>
          </section>

          {form.trigger === "comment" && (
            <section className="card">
              <div className="section-title">
                <h2>Public reply</h2>
                <p>Posted under their comment so others see it works</p>
              </div>
              <div className="field">
                <label htmlFor="reply">Reply</label>
                <input id="reply" className="input" value={form.commentReply} onChange={(e) => set({ commentReply: e.target.value })} />
                <span className="hint">Leave empty to skip the public reply</span>
              </div>
              <div className="field">
                <span className="label">Post the reply</span>
                <div>
                  <Segmented
                    value={form.replyPolicy}
                    onChange={(v) => set({ replyPolicy: v })}
                    label="Reply policy"
                    options={[
                      { value: "after_dm", label: "Only after the DM is sent" },
                      { value: "always", label: "Always" },
                    ]}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="card">
            <h2>Who gets it</h2>
            <div className="field">
              <span className="label">Send to</span>
              <div>
                <Segmented
                  value={form.audience}
                  onChange={(v) => set({ audience: v })}
                  label="Audience"
                  options={[
                    { value: "any", label: "Anyone" },
                    { value: "follower", label: "Followers only" },
                    { value: "non_follower", label: "Non-followers" },
                  ]}
                />
              </div>
            </div>
            <Check2 checked={form.followGate} onChange={(v) => set({ followGate: v })} label="Ask non-followers to follow first" hint="They get a follow button, then the link once they follow" />
            <Check2 checked={form.oncePerPerson} onChange={(v) => set({ oncePerPerson: v })} label="Once per person" hint="Someone who comments twice gets one DM" />
            {form.trigger === "comment" && (
              <>
                <Check2 checked={form.likeComment} onChange={(v) => set({ likeComment: v })} label="Like their comment" hint="A small signal that the automation saw it" />
                <Check2 checked={form.hideComment} onChange={(v) => set({ hideComment: v })} label="Hide their comment" hint="Keeps the thread clean when everyone comments the same word" />
              </>
            )}
            {!id && <Check2 checked={form.active} onChange={(v) => set({ active: v })} label="Go live when saved" hint="Off saves it paused" />}
          </section>

          {error && <ErrorNotice error={error} />}
          {problems.length > 0 && <p className="muted">{problems[0]}</p>}
        </div>

        <aside className="editor-preview">
          <span className="mono muted">What they see</span>
          <div className="convo">
            {form.trigger === "comment" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span className="where">On the post</span>
                <div className="convo-row">
                  <span className="avatar sm">IG</span>
                  <div className="body">
                    <b>their_username</b>
                    {form.keywords[0] ? <Key lit>{form.keywords[0]}</Key> : <span className="muted">any comment</span>}
                  </div>
                </div>
                {form.commentReply && (
                  <div className="convo-row indent">
                    <span className="avatar sm owner-avatar">{(account?.username || "").slice(0, 2).toUpperCase()}</span>
                    <div className="body">
                      <b>{account?.username}</b>
                      <span>{form.commentReply}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="where">{TRIGGERS.find((t) => t.value === form.trigger).label}</span>
            )}
            <hr />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="where">
                In their DMs{form.dmDelaySeconds ? `, ${DELAYS.find((d) => d.value === form.dmDelaySeconds)?.label} later` : ""}
              </span>
              <div className="dm-card">
                <p>{form.dmMessage || "Your message"}</p>
                {form.button?.url && <span className="dm-btn">{form.button.title || "Open link"}</span>}
              </div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Instagram allows one private reply per comment, within 7 days of the comment
          </p>
        </aside>
      </div>

      {picking && (
        <Drawer title="Pick a post" onClose={() => setPicking(false)}>
          {published.isLoading ? (
            <Skeleton h={300} />
          ) : (
            <div className="picker-list">
              {posts.filter((p) => p.platformPostId).map((p) => {
                const k = captionKeyword(p.caption);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      set({
                        postId: p.platformPostId,
                        postTitle: postTitle(p, 60),
                        keywords: form.keywords.length || !k ? form.keywords : [k.toUpperCase()],
                      });
                      setPicking(false);
                    }}
                  >
                    <Thumb src={p.thumbnailUrl} />
                    <span className="grow">
                      <span className="ellipsis" style={{ display: "block" }}>
                        {postTitle(p, 80)}
                      </span>
                      <span className="mono muted">
                        {dateShort(p.publishedAt)} · {num(p.metrics.comments)} comments
                      </span>
                    </span>
                    {k && <Key sm>{k}</Key>}
                  </button>
                );
              })}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

function Check2({ checked, onChange, label, hint }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
