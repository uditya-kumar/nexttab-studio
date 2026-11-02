import { firstLine } from "./format.js";

// Helpers over domain models (PublishedPost, QueuedPost, Automation, Comment).

export const postTitle = (p, max = 80) => firstLine(p?.caption, max) || "Untitled post";

export const KIND_LABEL = { reel: "Reel", post: "Post", carousel: "Carousel", story: "Story", video: "Video" };

// The keyword a caption asks people to comment, like: Comment "SEND".
export const captionKeyword = (text) => {
  const m = String(text || "").match(/comment\s+["“']([^"”']{1,24})["”']/i);
  return m ? m[1].trim() : null;
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mirrors the provider's match modes so the UI can mark which comments trigger.
export function matchesKeyword(text, keywords = [], mode = "word") {
  const t = String(text || "").toLowerCase().trim();
  for (const k of keywords) {
    const kw = String(k).toLowerCase().trim();
    if (!kw) continue;
    if (mode === "exact" && t === kw) return k;
    if (mode === "contains" && t.includes(kw)) return k;
    if (mode === "word" && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(kw)}($|[^\\p{L}\\p{N}])`, "u").test(t)) return k;
  }
  return null;
}

// Published posts whose caption asks for a keyword that no automation covers.
export function unautomated(posts, automations) {
  const covered = new Set((automations || []).map((a) => a.postId).filter(Boolean));
  const anyPost = (automations || []).some((a) => a.active && !a.postId && a.trigger === "comment");
  if (anyPost) return [];
  return (posts || [])
    .map((p) => ({ post: p, keyword: captionKeyword(p.caption) }))
    .filter((x) => x.keyword && x.post.platformPostId && !covered.has(x.post.platformPostId));
}

export const automateLink = (post, keyword) =>
  `/automations/new?post=${post.platformPostId}&title=${encodeURIComponent(postTitle(post, 60))}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`;
