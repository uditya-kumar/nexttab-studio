import { randomUUID } from "node:crypto";
import { get, n, post, put, s } from "./client.js";

/** @returns {import("../../domain.js").Conversation} */
const mapConversation = (c) => ({
  id: c.id,
  accountId: c.accountId,
  name: c.participantName || c.participantUsername || "Instagram user",
  username: /^\d+$/.test(c.participantUsername || "") ? null : s(c.participantUsername) || s(c.participantName),
  avatarUrl: s(c.participantPicture),
  lastMessage: c.lastMessage || "",
  updatedAt: s(c.updatedTime),
  unread: n(c.unreadCount) ?? 0,
  url: s(c.url),
  status: c.status === "archived" ? "archived" : "active",
});

const VIA = { human: "human", comment_automation: "automation", workflow: "automation", sequence: "automation", api: "api" };

/** @returns {import("../../domain.js").Message} */
const mapMessage = (m) => ({
  id: m.id,
  text: m.message || "",
  direction: m.direction === "incoming" ? "incoming" : "outgoing",
  createdAt: m.createdAt,
  status: s(m.deliveryStatus),
  via: VIA[m.sentVia] || (m.direction === "incoming" ? "human" : "other"),
  automationId: s(m.metadata?.automationId),
  attachments: (m.attachments || []).map((a) => ({ type: a.type || "file", url: s(a.url || a.payload?.url) })),
  isStoryReply: !!(m.storyReply || m.isStoryMention),
});

export async function listConversations(accountId, { status = "active", cursor, limit = 30 } = {}) {
  const d = await get("/inbox/conversations", { accountId, platform: "instagram", status, cursor, limit });
  return {
    items: (d.data || []).map(mapConversation),
    nextCursor: d.pagination?.hasMore ? d.pagination.nextCursor : null,
  };
}

export async function listMessages(conversationId, accountId) {
  const d = await get(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, { accountId, limit: 100 });
  return (d.messages || []).map(mapMessage);
}

export async function sendMessage(conversationId, accountId, text) {
  const d = await post(
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    { accountId, message: text },
    { headers: { "Idempotency-Key": randomUUID() } },
  );
  return { id: d.data?.messageId ?? null };
}

export async function setConversationStatus(conversationId, accountId, status) {
  await put(`/inbox/conversations/${encodeURIComponent(conversationId)}`, { accountId, status });
  return { status };
}
