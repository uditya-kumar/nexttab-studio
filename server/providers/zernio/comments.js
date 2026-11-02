import { randomUUID } from "node:crypto";
import { del, get, n, post, request, s } from "./client.js";

/** @returns {import("../../domain.js").CommentedPost} */
const mapCommentedPost = (p) => ({
  id: p.id,
  caption: p.content || "",
  thumbnailUrl: s(p.picture),
  url: s(p.permalink),
  createdAt: s(p.createdTime),
  commentCount: n(p.commentCount) ?? 0,
});

/** @returns {import("../../domain.js").Comment} */
const mapComment = (c) => ({
  id: c.id,
  text: c.message || "",
  createdAt: String(c.createdTime || "").replace(/\+0000$/, "Z"),
  author: {
    id: c.from?.id || "",
    username: c.from?.username || c.from?.name || "unknown",
    name: s(c.from?.name),
    avatarUrl: s(c.from?.picture),
    isOwner: !!c.from?.isOwner,
  },
  likeCount: n(c.likeCount) ?? 0,
  replyCount: n(c.replyCount) ?? 0,
  replies: (c.replies || []).map(mapComment),
  hidden: !!c.isHidden,
  can: { reply: c.canReply !== false, delete: !!c.canDelete, hide: c.canHide !== false },
  url: s(c.url),
});

export async function listCommentedPosts(accountId, cursor) {
  const d = await get("/inbox/comments", { accountId, platform: "instagram", limit: 20, cursor, sortBy: "date" });
  return {
    items: (d.data || []).map(mapCommentedPost),
    nextCursor: d.pagination?.hasMore ? d.pagination.nextCursor : null,
  };
}

export async function listComments(postId, accountId, cursor) {
  const d = await get(`/inbox/comments/${postId}`, { accountId, limit: 30, cursor });
  return {
    post: d.post
      ? { id: d.post.id, caption: d.post.text || "", thumbnailUrl: s(d.post.thumbnailUrl), url: s(d.post.permalink), createdAt: s(d.post.createdAt)?.replace(/\+0000$/, "Z") ?? null }
      : null,
    items: (d.comments || []).map(mapComment),
    nextCursor: d.pagination?.hasMore ? d.pagination.cursor : null,
  };
}

export const replyToComment = (postId, accountId, commentId, text) =>
  post(`/inbox/comments/${postId}`, { accountId, message: text, commentId }, { headers: { "Idempotency-Key": randomUUID() } });

export const privateReply = (postId, accountId, commentId, text) =>
  post(`/inbox/comments/${postId}/${commentId}/private-reply`, { accountId, message: text });

export async function setHidden(postId, accountId, commentId, hidden) {
  if (hidden) await post(`/inbox/comments/${postId}/${commentId}/hide`, { accountId });
  // Zernio reads accountId from the body on DELETE; send it in the query too for safety.
  else await request("DELETE", `/inbox/comments/${postId}/${commentId}/hide`, { params: { accountId }, body: { accountId } });
  return { hidden };
}

export const deleteComment = (postId, accountId, commentId) => del(`/inbox/comments/${postId}`, { accountId, commentId });
