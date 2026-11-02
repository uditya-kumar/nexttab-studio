import { AppError } from "../../errors.js";
import { get, n, s } from "./client.js";

/** @returns {import("../../domain.js").Account} */
export const mapAccount = (a) => ({
  id: a._id,
  platform: a.platform,
  username: a.username,
  displayName: s(a.displayName),
  avatarUrl: s(a.profilePicture),
  followers: n(a.followersCount),
  profileId: s(a.profileId),
});

export async function listAccounts() {
  const d = await get("/accounts", { platform: "instagram" });
  return (d.accounts || []).map(mapAccount);
}

// Checks a key before it is saved. Throws AppError when Zernio rejects it.
export async function validateKey(key) {
  await get("/accounts", { limit: 1 }, { key });
}

/** @returns {Promise<import("../../domain.js").AccountHealth>} */
export async function getHealth(accountId) {
  const h = await get(`/accounts/${accountId}/health`);
  const perms = h.permissions || {};
  return {
    status: h.status || "warning",
    tokenValid: !!h.tokenStatus?.valid,
    tokenExpiresAt: s(h.tokenStatus?.expiresAt),
    analyticsSync: h.analyticsSync?.status ?? null,
    analyticsSyncedAt: s(h.analyticsSync?.lastSyncedAt),
    permissions: [...(perms.posting || []), ...(perms.analytics || []), ...(perms.optional || [])].map((p) => ({
      scope: p.scope,
      granted: !!p.granted,
      required: !!p.required,
    })),
    issues: h.issues || [],
    recommendations: h.recommendations || [],
    messagingRestriction: s(h.messagingRestriction?.message),
  };
}

/** @returns {Promise<import("../../domain.js").Limits>} */
export async function getLimits(accountId, profileId) {
  const [limit, slot] = await Promise.all([
    get(`/accounts/${accountId}/instagram/publishing-limit`).catch(() => null),
    profileId
      ? get("/queue/next-slot", { profileId }).catch((err) => {
          // 404 means no queue is set up, which is a normal state.
          if (err instanceof AppError && err.status === 404) return null;
          throw err;
        })
      : null,
  ]);
  return {
    publishing: limit
      ? { used: n(limit.quotaUsage) ?? 0, total: n(limit.quotaTotal) ?? 0, windowSeconds: n(limit.quotaDurationSeconds) ?? 86400 }
      : null,
    queue: slot?.nextSlot ? { nextSlot: slot.nextSlot, name: s(slot.queueName) } : null,
  };
}

/** @returns {Promise<import("../../domain.js").Usage>} */
export async function getUsage() {
  const u = await get("/usage-stats");
  return { plan: s(u.planName), hasAccess: u.hasAccess !== false };
}
