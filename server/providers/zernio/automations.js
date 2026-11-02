import { del, get, n, patch, post, s } from "./client.js";

/** @returns {import("../../domain.js").Automation} */
export function mapAutomation(a) {
  const st = a.stats || {};
  const btn = (a.buttons || []).find((b) => b.type === "url");
  return {
    id: a.id,
    name: a.name || "",
    trigger: a.trigger || "comment",
    accountId: a.accountId,
    postId: s(a.platformPostId),
    postTitle: s(a.postTitle),
    keywords: a.keywords || [],
    matchMode: a.matchMode || "word",
    excludeKeywords: a.excludeKeywords || [],
    typoTolerance: !!a.typoTolerance,
    dmMessage: a.dmMessage || "",
    button: btn ? { title: btn.title || "", url: btn.url || "" } : null,
    linkTracking: !!a.linkTracking,
    dmDelaySeconds: n(a.dmDelaySeconds) ?? 0,
    commentReply: a.commentReply || "",
    replyPolicy: a.publicReplyPolicy === "always" ? "always" : "after_dm",
    audience: a.audience?.followerStatus || "any",
    followGate: !!a.followGate?.message,
    oncePerPerson: (a.repeatPolicy?.mode || "once") === "once",
    likeComment: !!a.actions?.likeComment,
    hideComment: !!a.actions?.hideComment,
    active: !!a.isActive,
    stats: {
      triggered: n(st.triggered) ?? 0,
      dmsSent: n(st.dmsSent) ?? 0,
      failed: n(st.dmsFailed) ?? 0,
      skipped: (n(st.audienceSkipped) ?? 0) + (n(st.skipped) ?? 0),
      linkClicks: n(st.linkClicks) ?? 0,
      people: n(st.uniqueContacts) ?? 0,
    },
    createdAt: s(a.createdAt),
  };
}

const FOLLOW_GATE = {
  message: "Follow this account first and the link arrives right after",
  buttonLabel: "I followed",
  profileButtonLabel: "Open profile",
  notFollowingMessage: "Looks like you are not following yet. Follow, then tap the button again",
};

/** @param {Partial<import("../../domain.js").Automation>} x */
function toBody(x) {
  const b = {};
  const set = (k, v) => v !== undefined && (b[k] = v);
  set("name", x.name);
  set("trigger", x.trigger);
  set("keywords", x.keywords);
  set("matchMode", x.matchMode);
  set("excludeKeywords", x.excludeKeywords);
  set("typoTolerance", x.typoTolerance);
  set("dmMessage", x.dmMessage);
  if (x.button !== undefined) b.buttons = x.button?.url ? [{ type: "url", title: x.button.title || "Open link", url: x.button.url }] : [];
  set("linkTracking", x.linkTracking);
  set("dmDelaySeconds", x.dmDelaySeconds);
  set("commentReply", x.commentReply);
  set("publicReplyPolicy", x.replyPolicy);
  if (x.audience !== undefined) b.audience = { followerStatus: x.audience, whenUnknown: "send" };
  if (x.followGate !== undefined) b.followGate = x.followGate ? FOLLOW_GATE : { message: "" };
  if (x.oncePerPerson !== undefined) b.repeatPolicy = { mode: x.oncePerPerson ? "once" : "every_comment" };
  if (x.likeComment !== undefined || x.hideComment !== undefined)
    b.actions = { likeComment: !!x.likeComment, hideComment: !!x.hideComment };
  set("isActive", x.active);
  if (x.postId !== undefined) b.platformPostId = x.postId;
  if (x.postTitle !== undefined) b.postTitle = x.postTitle;
  return b;
}

export async function listAutomations() {
  const d = await get("/comment-automations");
  return (d.automations || []).map(mapAutomation);
}

export async function getAutomation(id) {
  const d = await get(`/comment-automations/${id}`);
  return mapAutomation(d.automation || d);
}

export async function createAutomation(input, profileId) {
  const body = { ...toBody(input), accountId: input.accountId, profileId };
  if (!body.platformPostId) delete body.platformPostId;
  const d = await post("/comment-automations", body);
  return d?.automation ? mapAutomation(d.automation) : null;
}

export async function updateAutomation(id, changes) {
  const d = await patch(`/comment-automations/${id}`, toBody(changes));
  return d?.automation ? mapAutomation(d.automation) : null;
}

export const deleteAutomation = (id) => del(`/comment-automations/${id}`);

/** @returns {Promise<import("../../domain.js").AutomationActivity>} */
export async function getActivity(id, { status, limit = 50 } = {}) {
  const d = await get(`/comment-automations/${id}/logs`, { status, limit });
  return {
    logs: (d.logs || []).map((l) => ({
      id: l.id,
      commentId: s(l.commentId),
      person: { id: l.commenterId, username: s(l.commenterUsername), name: s(l.commenterName) },
      text: s(l.commentText),
      status: l.status,
      error: s(l.error),
      replyStatus: s(l.commentReplyStatus),
      clicks: n(l.clickCount) ?? 0,
      createdAt: l.createdAt,
    })),
    total: n(d.pagination?.total) ?? 0,
    hasMore: !!d.pagination?.hasMore,
    misses: {
      total: n(d.misses?.total) ?? 0,
      days: n(d.misses?.retentionDays) ?? 14,
      samples: (d.misses?.samples || []).map((m) => ({ text: m.commentText, username: s(m.commenterName), at: m.at })),
    },
  };
}

/** @returns {Promise<import("../../domain.js").Workflow[]>} */
export async function listWorkflows() {
  const d = await get("/workflows", { limit: 50 });
  return (d.workflows || []).map((w) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    started: n(w.totalStarted) ?? 0,
    completed: n(w.totalCompleted) ?? 0,
  }));
}

export const setWorkflowActive = (id, active) => post(`/workflows/${id}/${active ? "activate" : "pause"}`);
