import { randomUUID } from "node:crypto";
import { AppError } from "../../errors.js";
import { del, get, post, put, s } from "./client.js";

/** @returns {import("../../domain.js").QueuedPost} */
function mapQueued(p) {
  const ig = (p.platforms || []).find((x) => x.platform === "instagram") || {};
  const psd = ig.platformSpecificData || {};
  const media = (p.mediaItems || []).map((m) => ({
    type: m.type === "video" ? "video" : "image",
    url: m.url,
    thumbnail: s(m.thumbnail),
  }));
  return {
    id: p._id,
    caption: p.content || "",
    status: p.status,
    scheduledFor: s(p.scheduledFor),
    updatedAt: s(p.updatedAt),
    media,
    error: s(ig.errorMessage),
    url: s(ig.platformPostUrl),
    options: {
      format: psd.contentType === "story" ? "story" : media.some((m) => m.type === "video") ? "reel" : "feed",
      firstComment: psd.firstComment || "",
      collaborators: psd.collaborators || [],
      shareToFeed: psd.shareToFeed !== false,
      commentsEnabled: psd.commentsEnabled !== false,
    },
  };
}

export async function listQueued(accountId, status) {
  const d = await get("/posts", {
    accountId,
    status,
    limit: 50,
    sortBy: status === "scheduled" ? "scheduled-asc" : "created-desc",
  });
  return (d.posts || []).map(mapQueued);
}

export async function getQueued(id) {
  const d = await get(`/posts/${id}`);
  return mapQueued(d.post || d);
}

/** @param {import("../../domain.js").PostInput} input */
function toBody(input) {
  const o = input.options || {};
  const psd = {};
  if (o.format === "story") psd.contentType = "story";
  if (o.format === "reel") psd.shareToFeed = o.shareToFeed !== false;
  if (o.format !== "story") {
    if (o.firstComment?.trim()) psd.firstComment = o.firstComment.trim();
    if (o.collaborators?.length) psd.collaborators = o.collaborators.slice(0, 3);
    if (o.commentsEnabled === false) psd.commentsEnabled = false;
  }
  const body = {
    content: o.format === "story" ? "" : input.caption || "",
    mediaItems: (input.media || []).map((m) => ({ type: m.type, url: m.url })),
    platforms: [{ platform: "instagram", accountId: input.accountId, platformSpecificData: psd }],
  };
  if (input.when === "now") body.publishNow = true;
  else if (input.when === "draft") body.isDraft = true;
  else if (input.when === "queue") {
    if (!input.profileId) throw new AppError("This account has no profile to queue into", { status: 400 });
    body.queuedFromProfile = input.profileId;
  } else {
    body.scheduledFor = input.scheduledFor;
    body.timezone = input.timezone;
  }
  return body;
}

export async function createPost(input) {
  const d = await post("/posts", toBody(input), { headers: { "Idempotency-Key": randomUUID() } });
  return { post: d.post ? mapQueued(d.post) : null, warnings: d.warnings || [] };
}

export async function updatePost(id, input) {
  const d = await put(`/posts/${id}`, toBody(input));
  return { post: d.post ? mapQueued(d.post) : null, warnings: d.warnings || [] };
}

export const deletePost = (id) => del(`/posts/${id}`);
export const retryPost = (id) => post(`/posts/${id}/retry`);
export const publishNow = (id) => put(`/posts/${id}`, { publishNow: true });

// Presigns an upload, then streams the file to storage. Returns a public URL to attach to a post.
export async function uploadMedia({ filename, contentType, size, stream }) {
  const signed = await post("/media/presign", { filename, contentType, size });
  const res = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(size) },
    body: stream,
    duplex: "half",
  });
  if (!res.ok) throw new AppError(`Storage upload failed (${res.status})`, { status: 502, code: "upload_failed" });
  return { url: signed.publicUrl, type: contentType.startsWith("video") ? "video" : "image" };
}
