// One hook per app endpoint. Data shapes are the domain models in server/domain.js.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { useToast } from "../components/Toast.jsx";

const MIN = 60_000;

export const useSession = () => useQuery({ queryKey: ["session"], queryFn: () => api.get("/session"), staleTime: Infinity });

export const useAccounts = (enabled = true) =>
  useQuery({ queryKey: ["accounts"], queryFn: () => api.get("/accounts"), enabled, staleTime: 5 * MIN });

export const useHealth = (accountId) =>
  useQuery({ queryKey: ["health", accountId], queryFn: () => api.get(`/accounts/${accountId}/health`), enabled: !!accountId, staleTime: 5 * MIN });

export const useLimits = (accountId, profileId) =>
  useQuery({
    queryKey: ["limits", accountId, profileId],
    queryFn: () => api.get(`/accounts/${accountId}/limits`, { profileId }),
    enabled: !!accountId,
  });

export const useUsage = (enabled = true) => useQuery({ queryKey: ["usage"], queryFn: () => api.get("/usage"), enabled, staleTime: 5 * MIN });

// Analytics

export const useInsights = (accountId, from, to) =>
  useQuery({
    queryKey: ["insights", accountId, from, to],
    queryFn: () => api.get(`/accounts/${accountId}/insights`, { from, to }),
    enabled: !!accountId,
    staleTime: 10 * MIN,
  });

export const useReach = (accountId, from, to) =>
  useQuery({
    queryKey: ["reach", accountId, from, to],
    queryFn: () => api.get(`/accounts/${accountId}/reach`, { from, to }),
    enabled: !!accountId,
    staleTime: 10 * MIN,
  });

export const usePublished = (accountId, { from, to, sort = "date", order = "desc", page = 1, limit = 24 } = {}) =>
  useQuery({
    queryKey: ["published", accountId, from, to, sort, order, page, limit],
    queryFn: () => api.get(`/accounts/${accountId}/published`, { from, to, sort, order, page, limit }),
    enabled: !!accountId,
    staleTime: 5 * MIN,
    placeholderData: (prev) => prev,
  });

export const usePostTimeline = (postId) =>
  useQuery({ queryKey: ["timeline", postId], queryFn: () => api.get(`/published/${postId}/timeline`), enabled: !!postId });

export const useBestTimes = (accountId) =>
  useQuery({ queryKey: ["best-times", accountId], queryFn: () => api.get(`/accounts/${accountId}/best-times`), enabled: !!accountId, staleTime: 30 * MIN });

export const useOnlineFollowers = (accountId) =>
  useQuery({
    queryKey: ["online", accountId],
    queryFn: () => api.get(`/accounts/${accountId}/online-followers`),
    enabled: !!accountId,
    staleTime: 30 * MIN,
  });

export const useDemographics = (accountId, audience = "followers") =>
  useQuery({
    queryKey: ["demographics", accountId, audience],
    queryFn: () => api.get(`/accounts/${accountId}/demographics`, { audience }),
    enabled: !!accountId,
    staleTime: 30 * MIN,
  });

// Queued posts

export const useQueued = (accountId, status) =>
  useQuery({ queryKey: ["posts", accountId, status], queryFn: () => api.get("/posts", { accountId, status }), enabled: !!accountId });

export const useQueuedPost = (id) => useQuery({ queryKey: ["post", id], queryFn: () => api.get(`/posts/${id}`), enabled: !!id });

// Messages

export const useConversations = (accountId, status = "active") =>
  useInfiniteQuery({
    queryKey: ["conversations", accountId, status],
    queryFn: ({ pageParam }) => api.get("/conversations", { accountId, status, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last?.nextCursor || undefined,
    enabled: !!accountId,
    refetchInterval: 60_000,
  });

export const useMessages = (conversationId, accountId) =>
  useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.get(`/conversations/${encodeURIComponent(conversationId)}/messages`, { accountId }),
    enabled: !!conversationId && !!accountId,
    refetchInterval: 30_000,
  });

// Comments

export const useCommentedPosts = (accountId) =>
  useInfiniteQuery({
    queryKey: ["commented-posts", accountId],
    queryFn: ({ pageParam }) => api.get("/commented-posts", { accountId, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last?.nextCursor || undefined,
    enabled: !!accountId,
  });

export const useComments = (postId, accountId) =>
  useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: ({ pageParam }) => api.get("/comments", { postId, accountId, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last?.nextCursor || undefined,
    enabled: !!postId && !!accountId,
  });

// Automations

export const useAutomations = (enabled = true) =>
  useQuery({ queryKey: ["automations"], queryFn: () => api.get("/automations"), enabled });

export const useAutomation = (id) =>
  useQuery({ queryKey: ["automation", id], queryFn: () => api.get(`/automations/${id}`), enabled: !!id });

export const useAutomationActivity = (id, status) =>
  useQuery({
    queryKey: ["automation-activity", id, status],
    queryFn: () => api.get(`/automations/${id}/activity`, { status }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });

export const useWorkflows = () => useQuery({ queryKey: ["workflows"], queryFn: () => api.get("/workflows") });

// Wraps a write with a toast and cache invalidation.
export function useAction(fn, { success, invalidate = [], onSuccess } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      for (const key of invalidate) qc.invalidateQueries({ queryKey: key });
      if (success) toast.show(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => toast.show(err.message, "error"),
  });
}
