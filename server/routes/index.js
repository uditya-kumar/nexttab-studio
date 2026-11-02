// App API. Provider-agnostic: everything goes through `provider`, which returns domain models.
import express from "express";
import { config, writeEnvValue } from "../config.js";
import { badRequest } from "../errors.js";
import { provider } from "../providers/index.js";

const { accounts, analytics, posts, inbox, comments, automations } = provider;

export const api = express.Router();
const json = express.json({ limit: "1mb" });

const need = (v, name) => {
  if (v === undefined || v === null || v === "") throw badRequest(`${name} is required`);
  return String(v);
};
const date = (v, name) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ""))) throw badRequest(`${name} must be YYYY-MM-DD`);
  return String(v);
};

// Session: is a key configured, save or remove it
api.get("/session", (_req, res) => {
  res.json({ hasKey: Boolean(config.apiKey), provider: provider.name, dashboardUrl: provider.dashboardUrl });
});
api.post("/session/key", json, async (req, res) => {
  const key = String(req.body?.apiKey || "").trim();
  if (!key) throw badRequest("Enter an API key");
  if (!/^[\w.\-]+$/.test(key)) throw badRequest("That does not look like an API key");
  await accounts.validateKey(key);
  writeEnvValue("ZERNIO_API_KEY", key);
  res.json({ hasKey: true, provider: provider.name, dashboardUrl: provider.dashboardUrl });
});
api.delete("/session/key", (_req, res) => {
  writeEnvValue("ZERNIO_API_KEY", "");
  res.json({ hasKey: false, provider: provider.name, dashboardUrl: provider.dashboardUrl });
});

// Accounts
api.get("/accounts", async (_req, res) => res.json(await accounts.listAccounts()));
api.get("/accounts/:id/health", async (req, res) => res.json(await accounts.getHealth(req.params.id)));
api.get("/accounts/:id/limits", async (req, res) => res.json(await accounts.getLimits(req.params.id, req.query.profileId)));
api.get("/usage", async (_req, res) => res.json(await accounts.getUsage()));

// Analytics
api.get("/accounts/:id/insights", async (req, res) =>
  res.json(await analytics.getInsights(req.params.id, date(req.query.from, "from"), date(req.query.to, "to"))),
);
api.get("/accounts/:id/reach", async (req, res) =>
  res.json(await analytics.getReachSeries(req.params.id, date(req.query.from, "from"), date(req.query.to, "to"))),
);
api.get("/accounts/:id/published", async (req, res) => {
  const q = req.query;
  res.json(
    await analytics.getPublishedPosts(req.params.id, {
      from: q.from || undefined,
      to: q.to || undefined,
      sort: q.sort,
      order: q.order === "asc" ? "asc" : "desc",
      page: Math.max(1, Number(q.page) || 1),
      limit: Math.min(100, Math.max(1, Number(q.limit) || 24)),
    }),
  );
});
api.get("/accounts/:id/best-times", async (req, res) => res.json(await analytics.getBestTimes(req.params.id)));
api.get("/accounts/:id/online-followers", async (req, res) => res.json(await analytics.getOnlineFollowers(req.params.id)));
api.get("/accounts/:id/demographics", async (req, res) =>
  res.json(await analytics.getDemographics(req.params.id, req.query.audience === "engaged" ? "engaged" : "followers")),
);
api.get("/published/:postId/timeline", async (req, res) => res.json(await analytics.getPostTimeline(req.params.postId)));

// Queued posts (scheduled, drafts, failed)
const STATUSES = new Set(["scheduled", "draft", "failed", "publishing", "published", "partial", "cancelled"]);
api.get("/posts", async (req, res) => {
  const status = need(req.query.status, "status");
  if (!STATUSES.has(status)) throw badRequest("Unknown status");
  res.json(await posts.listQueued(need(req.query.accountId, "accountId"), status));
});
api.get("/posts/:id", async (req, res) => res.json(await posts.getQueued(req.params.id)));
api.post("/posts", json, async (req, res) => res.json(await posts.createPost(validatePost(req.body))));
api.put("/posts/:id", json, async (req, res) => res.json(await posts.updatePost(req.params.id, validatePost(req.body))));
api.delete("/posts/:id", async (req, res) => res.json(await posts.deletePost(req.params.id)));
api.post("/posts/:id/retry", async (req, res) => res.json(await posts.retryPost(req.params.id)));
api.post("/posts/:id/publish", async (req, res) => res.json(await posts.publishNow(req.params.id)));

function validatePost(b) {
  need(b?.accountId, "accountId");
  if (!["now", "schedule", "queue", "draft"].includes(b.when)) throw badRequest("when must be now, schedule, queue or draft");
  if (!Array.isArray(b.media) || !b.media.length) throw badRequest("Add a photo or video");
  if (b.when === "schedule" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(b.scheduledFor || "")) throw badRequest("Pick a date and time");
  return b;
}

// Media upload: the browser streams the raw file body
api.post("/media", async (req, res) => {
  const contentType = need(req.query.contentType || req.headers["content-type"], "contentType");
  const size = Number(req.query.size || req.headers["content-length"]);
  if (!size) throw badRequest("File size is required");
  res.json(await posts.uploadMedia({ filename: String(req.query.filename || "upload"), contentType, size, stream: req }));
});

// Messages
api.get("/conversations", async (req, res) =>
  res.json(
    await inbox.listConversations(need(req.query.accountId, "accountId"), {
      status: req.query.status === "archived" ? "archived" : "active",
      cursor: req.query.cursor || undefined,
    }),
  ),
);
api.get("/conversations/:id/messages", async (req, res) =>
  res.json(await inbox.listMessages(req.params.id, need(req.query.accountId, "accountId"))),
);
api.post("/conversations/:id/messages", json, async (req, res) =>
  res.json(await inbox.sendMessage(req.params.id, need(req.body?.accountId, "accountId"), need(req.body?.text, "text"))),
);
api.patch("/conversations/:id", json, async (req, res) => {
  const status = req.body?.status === "archived" ? "archived" : "active";
  res.json(await inbox.setConversationStatus(req.params.id, need(req.body?.accountId, "accountId"), status));
});

// Comments
api.get("/commented-posts", async (req, res) =>
  res.json(await comments.listCommentedPosts(need(req.query.accountId, "accountId"), req.query.cursor || undefined)),
);
api.get("/comments", async (req, res) =>
  res.json(
    await comments.listComments(need(req.query.postId, "postId"), need(req.query.accountId, "accountId"), req.query.cursor || undefined),
  ),
);
api.post("/comments/reply", json, async (req, res) => {
  const b = req.body || {};
  res.json(await comments.replyToComment(need(b.postId, "postId"), need(b.accountId, "accountId"), need(b.commentId, "commentId"), need(b.text, "text")));
});
api.post("/comments/dm", json, async (req, res) => {
  const b = req.body || {};
  res.json(await comments.privateReply(need(b.postId, "postId"), need(b.accountId, "accountId"), need(b.commentId, "commentId"), need(b.text, "text")));
});
api.post("/comments/hidden", json, async (req, res) => {
  const b = req.body || {};
  res.json(await comments.setHidden(need(b.postId, "postId"), need(b.accountId, "accountId"), need(b.commentId, "commentId"), !!b.hidden));
});
api.delete("/comments", async (req, res) => {
  const q = req.query;
  res.json(await comments.deleteComment(need(q.postId, "postId"), need(q.accountId, "accountId"), need(q.commentId, "commentId")));
});

// Automations
api.get("/automations", async (_req, res) => res.json(await automations.listAutomations()));
api.get("/automations/:id", async (req, res) => res.json(await automations.getAutomation(req.params.id)));
api.post("/automations", json, async (req, res) => {
  const b = req.body || {};
  need(b.accountId, "accountId");
  if (!b.dmMessage?.trim()) throw badRequest("Write the DM message");
  res.json(await automations.createAutomation(b, req.query.profileId || b.profileId));
});
api.patch("/automations/:id", json, async (req, res) => res.json(await automations.updateAutomation(req.params.id, req.body || {})));
api.delete("/automations/:id", async (req, res) => res.json(await automations.deleteAutomation(req.params.id)));
api.get("/automations/:id/activity", async (req, res) =>
  res.json(await automations.getActivity(req.params.id, { status: req.query.status || undefined, limit: Number(req.query.limit) || 50 })),
);
api.get("/workflows", async (_req, res) => res.json(await automations.listWorkflows()));
api.post("/workflows/:id/active", json, async (req, res) =>
  res.json(await automations.setWorkflowActive(req.params.id, !!req.body?.active)),
);

api.use((_req, res) => res.status(404).json({ error: "Not found", code: "not_found" }));
