import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Film, Heart, Image as ImageIcon, Link2, MessageCircle, Send, Trash2, Upload } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api, uploadFile } from "../lib/api.js";
import { useBestTimes, useLimits, useQueuedPost } from "../lib/queries.js";
import { WEEKDAYS, dateTime, num, tz } from "../lib/format.js";
import { useToast } from "../components/Toast.jsx";
import { Avatar, ErrorNotice, ICON, Key, PageHead, Segmented, Spinner } from "../components/ui.jsx";

const FORMATS = [
  { value: "reel", label: "Reel" },
  { value: "feed", label: "Feed post" },
  { value: "story", label: "Story" },
];

const WHEN = [
  { value: "schedule", label: "Schedule" },
  { value: "queue", label: "Next queue slot" },
  { value: "now", label: "Publish now" },
  { value: "draft", label: "Save draft" },
];

const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;

const localInput = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// The next local datetime that falls on the best slot (UTC weekday + hour).
function nextBestSlot(slot) {
  if (!slot) return null;
  const now = new Date();
  const t = new Date(now);
  t.setUTCHours(slot.hour, 0, 0, 0);
  const diff = (slot.weekday - t.getUTCDay() + 7) % 7;
  t.setUTCDate(t.getUTCDate() + diff);
  if (t <= now) t.setUTCDate(t.getUTCDate() + 7);
  return t;
}

export default function Compose() {
  const { postId } = useParams();
  const editing = useQueuedPost(postId);
  const { account, accountId, profileId } = useAccount();
  const limits = useLimits(accountId, profileId);
  const best = useBestTimes(accountId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const bestSlot = best.data?.[0] || null;
  const bestDate = useMemo(() => nextBestSlot(bestSlot), [bestSlot]);

  const [format, setFormat] = useState("reel");
  const [media, setMedia] = useState([]);
  const [caption, setCaption] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [collaborators, setCollaborators] = useState("");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [when, setWhen] = useState("schedule");
  const [scheduledAt, setScheduledAt] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  // Default the schedule to the next best slot, or tomorrow at 18:00.
  useEffect(() => {
    if (scheduledAt || postId) return;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(18, 0, 0, 0);
    if (best.isFetched || best.isError) setScheduledAt(localInput(bestDate || fallback));
  }, [best.isFetched, best.isError, bestDate, scheduledAt, postId]);

  useEffect(() => {
    const p = editing.data;
    if (!p) return;
    setCaption(p.caption);
    setMedia(p.media.map((m) => ({ id: m.url, url: m.url, type: m.type, name: m.url.split("/").pop().split("?")[0] })));
    setFormat(p.options.format);
    setFirstComment(p.options.firstComment);
    setCollaborators(p.options.collaborators.join(", "));
    setShareToFeed(p.options.shareToFeed);
    setCommentsEnabled(p.options.commentsEnabled);
    setWhen(p.status === "draft" ? "draft" : "schedule");
    setScheduledAt(localInput(p.scheduledFor || Date.now() + 86400_000));
  }, [editing.data]);

  const hashtags = useMemo(() => (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length, [caption]);
  const uploading = media.some((m) => m.progress !== undefined && m.progress < 1 && !m.error);
  const ready = media.filter((m) => m.url && !m.error);
  const queue = limits.data?.queue;

  const problems = [];
  if (!ready.length) problems.push("Add a photo or video");
  if (format === "reel" && ready.length && !ready.some((m) => m.type === "video")) problems.push("A reel needs a video");
  if (format === "story" && ready.length > 1) problems.push("A story takes one photo or video");
  if (caption.length > CAPTION_MAX) problems.push(`Caption is over ${num(CAPTION_MAX)} characters`);
  if (hashtags > HASHTAG_MAX) problems.push(`Instagram allows ${HASHTAG_MAX} hashtags`);
  if (when === "schedule" && (!scheduledAt || new Date(scheduledAt) <= new Date())) problems.push("Pick a time in the future");
  if (when === "queue" && !queue) problems.push("No posting queue is set up");

  const addFiles = async (files) => {
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      const type = file.type.startsWith("video") ? "video" : "image";
      setMedia((list) => [...list, { id, name: file.name, size: file.size, type, preview: URL.createObjectURL(file), progress: 0 }]);
      try {
        const res = await uploadFile(file, (progress) => setMedia((list) => list.map((m) => (m.id === id ? { ...m, progress } : m))));
        setMedia((list) => list.map((m) => (m.id === id ? { ...m, url: res.url, progress: 1 } : m)));
      } catch (err) {
        setMedia((list) => list.map((m) => (m.id === id ? { ...m, error: err.message } : m)));
      }
    }
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!/^https:\/\//.test(url)) return toast.show("Enter a public https link to a photo or video", "error");
    const type = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url) ? "video" : "image";
    setMedia((list) => [...list, { id: url, url, type, name: url.split("/").pop().split("?")[0] }]);
    setUrlInput("");
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    const body = {
      accountId,
      profileId,
      caption,
      media: ready.map((m) => ({ type: m.type, url: m.url })),
      options: {
        format,
        firstComment,
        collaborators: collaborators.split(/[,\s]+/).map((s) => s.replace(/^@/, "")).filter(Boolean),
        shareToFeed,
        commentsEnabled,
      },
      when,
      scheduledFor: scheduledAt,
      timezone: tz(),
    };
    try {
      const res = postId ? await api.put(`/posts/${postId}`, body) : await api.post("/posts", body);
      for (const w of res?.warnings || []) toast.show(w);
      toast.show(
        when === "now"
          ? "Publishing to Instagram"
          : when === "draft"
            ? "Draft saved"
            : `Scheduled for ${dateTime(res?.post?.scheduledFor || (when === "queue" ? queue?.nextSlot : scheduledAt))}`,
      );
      qc.invalidateQueries({ queryKey: ["posts"] });
      navigate("/content");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const shortTime = (d) => `${WEEKDAYS[d.getDay()].slice(0, 3)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const cta = {
    now: "Publish now",
    draft: "Save draft",
    queue: "Add to queue",
    schedule: scheduledAt ? `Schedule for ${shortTime(new Date(scheduledAt))}` : "Schedule",
  }[when];
  const pub = limits.data?.publishing;

  return (
    <div className="page">
      <PageHead title={postId ? "Edit post" : "New post"} sub={`Publishing to @${account?.username} on Instagram`}>
        {pub && (
          <span className="mono muted">
            {num(pub.used)} of {num(pub.total)} API publishes used in the last 24 hours
          </span>
        )}
      </PageHead>

      {editing.isError && <ErrorNotice error={editing.error} />}

      <div className="compose">
        <div className="compose-form">
          <section className="card">
            <div className="card-head">
              <h2>Format</h2>
              <Segmented value={format} onChange={setFormat} options={FORMATS} label="Format" />
            </div>
            <div
              className={`drop ${drag ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                addFiles([...e.dataTransfer.files]);
              }}
            >
              <Upload size={18} strokeWidth={1.5} className="muted" />
              <div>
                <b>Drop a video or photos here</b>
                <div className="muted">MP4 or MOV for reels, JPG or PNG for posts. Several photos make a carousel</div>
              </div>
              <button className="btn sm" type="button" onClick={() => fileRef.current?.click()}>
                Choose files
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple={format === "feed"}
                accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  addFiles([...e.target.files]);
                  e.target.value = "";
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Or paste a public media link"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
              />
              <button className="btn" type="button" onClick={addUrl} disabled={!urlInput.trim()}>
                <Link2 {...ICON} /> Add
              </button>
            </div>
            {media.length > 0 && (
              <div className="media-list">
                {media.map((m) => (
                  <div className="media-item" key={m.id}>
                    {m.type === "video" ? <Film {...ICON} className="muted" /> : <ImageIcon {...ICON} className="muted" />}
                    <span className="ellipsis grow">{m.name}</span>
                    {m.size && <span className="mono muted">{(m.size / 1048576).toFixed(1)} MB</span>}
                    {m.error ? (
                      <span className="negative" style={{ fontSize: 13 }}>{m.error}</span>
                    ) : m.progress !== undefined && m.progress < 1 ? (
                      <span className="mono muted">{Math.round(m.progress * 100)}%</span>
                    ) : (
                      <span className="mono positive">Ready</span>
                    )}
                    <button className="btn ghost sm icon" aria-label={`Remove ${m.name}`} onClick={() => setMedia((l) => l.filter((x) => x.id !== m.id))}>
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {format !== "story" && (
            <section className="card">
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label htmlFor="caption">Caption</label>
                  <span className={`mono ${caption.length > CAPTION_MAX || hashtags > HASHTAG_MAX ? "negative" : "muted"}`}>
                    {num(caption.length)} / {num(CAPTION_MAX)} · {hashtags} / {HASHTAG_MAX} hashtags
                  </span>
                </div>
                <textarea
                  id="caption"
                  className="textarea"
                  rows={9}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={'What the tool does and why it helps, then: Comment "KEYWORD" and I\'ll DM you the GitHub link'}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="first-comment">First comment</label>
                  <input id="first-comment" className="input" value={firstComment} onChange={(e) => setFirstComment(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="collab">Collaborators</label>
                  <input id="collab" className="input" value={collaborators} onChange={(e) => setCollaborators(e.target.value)} placeholder="@username, up to 3" />
                </div>
                {format === "reel" && (
                  <label className="check">
                    <input type="checkbox" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} />
                    <span className="text">
                      Also show in the profile grid
                      <small>Off keeps the reel in the Reels tab only</small>
                    </span>
                  </label>
                )}
                <label className="check">
                  <input type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} />
                  <span className="text">
                    Allow comments
                    <small>Comment automations need comments on</small>
                  </span>
                </label>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>When</h2>
              <Segmented value={when} onChange={setWhen} options={WHEN} label="When to publish" />
            </div>
            {when === "schedule" && (
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="when">Date and time</label>
                  <input
                    id="when"
                    type="datetime-local"
                    className="input"
                    value={scheduledAt || ""}
                    min={localInput(new Date())}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <span className="hint">Your time zone, {tz()}</span>
                </div>
                {bestDate && (
                  <div className="tip-row">
                    <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setScheduledAt(localInput(bestDate))}>
                      <Key lit>{shortTime(bestDate).toUpperCase()}</Key>
                    </button>
                    <span>Your best slot, {num(bestSlot.avgEngagement)} average engagement</span>
                  </div>
                )}
              </div>
            )}
            {when === "queue" && (
              <p className="secondary">
                {queue
                  ? `Next free slot is ${dateTime(queue.nextSlot)}${queue.name ? ` in ${queue.name}` : ""}`
                  : "No posting queue is set up for this account yet. Create one in the dashboard, or schedule a time instead"}
              </p>
            )}
            {when === "now" && <p className="secondary">Goes live as soon as Instagram finishes processing the media</p>}
            {when === "draft" && <p className="secondary">Saved without a time. Open it from Content to finish</p>}
          </section>

          {error && <ErrorNotice error={error} />}

          <div className="compose-actions">
            <span className="muted">{uploading ? "Uploading media" : problems[0] || "Ready to go"}</span>
            <button className="btn accent" onClick={submit} disabled={busy || uploading || problems.length > 0}>
              {busy ? <Spinner size={14} /> : <Send {...ICON} />}
              {cta}
            </button>
          </div>
        </div>

        <aside className="compose-preview">
          <span className="mono muted">Preview</span>
          <Preview account={account} media={media} caption={format === "story" ? "" : caption} format={format} />
        </aside>
      </div>
    </div>
  );
}

function Preview({ account, media, caption, format }) {
  const first = media.find((m) => !m.error);
  const src = first?.preview || first?.url;
  const [more, setMore] = useState(false);
  const firstLine = caption.split("\n").find((l) => l.trim()) || "";
  const long = caption.trim() !== firstLine.trim() || firstLine.length > 90;
  return (
    <div className={`phone ${format}`}>
      <div className="phone-head">
        <Avatar src={account?.avatarUrl} name={account?.username} size="sm" />
        <b>{account?.username}</b>
        {format === "reel" && <span className="mono muted">Reel</span>}
      </div>
      <div className="phone-media">
        {src ? (
          first.type === "video" ? <video src={src} muted loop playsInline autoPlay /> : <img src={src} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="muted">Your media shows here</span>
        )}
        {media.length > 1 && <span className="phone-count mono">1 / {media.length}</span>}
      </div>
      {format !== "story" && (
        <div className="phone-body">
          <div className="phone-actions">
            <Heart size={18} strokeWidth={1.5} />
            <MessageCircle size={18} strokeWidth={1.5} />
            <Send size={18} strokeWidth={1.5} />
          </div>
          {caption ? (
            <p className="phone-caption">
              <b>{account?.username}</b>
              {more ? caption : firstLine.slice(0, 90)}
              {!more && long && (
                <button className="link-btn" onClick={() => setMore(true)}>
                  … more
                </button>
              )}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Caption preview
            </p>
          )}
        </div>
      )}
    </div>
  );
}
