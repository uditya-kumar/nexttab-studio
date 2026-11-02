// App data models. Providers map their responses into these shapes and the UI reads only these.
// A field the provider cannot supply is null. Times are ISO strings, dates are YYYY-MM-DD.

/**
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} platform
 * @property {string} username
 * @property {string|null} displayName
 * @property {string|null} avatarUrl
 * @property {number|null} followers
 * @property {string|null} profileId
 */

/**
 * @typedef {Object} AccountHealth
 * @property {"healthy"|"warning"|"error"} status
 * @property {boolean} tokenValid
 * @property {string|null} tokenExpiresAt
 * @property {"ok"|"failing"|"stalled"|"never_synced"|null} analyticsSync
 * @property {string|null} analyticsSyncedAt
 * @property {{ scope: string, granted: boolean, required: boolean }[]} permissions
 * @property {string[]} issues
 * @property {string[]} recommendations
 * @property {string|null} messagingRestriction
 */

/**
 * @typedef {Object} Limits
 * @property {{ used: number, total: number, windowSeconds: number }|null} publishing
 * @property {{ nextSlot: string, name: string|null }|null} queue  null when no posting queue is set up
 */

/**
 * @typedef {Object} Usage
 * @property {string|null} plan
 * @property {boolean} hasAccess
 */

/**
 * @typedef {Object} Insights
 * @property {{ from: string, to: string }} range
 * @property {{ reach: number|null, views: number|null, accountsEngaged: number|null, interactions: number|null,
 *   profileViews: number|null, likes: number|null, comments: number|null, saves: number|null, shares: number|null,
 *   websiteClicks: number|null }} totals
 * @property {string[]} unavailable  metric names the provider could not return
 */

/** @typedef {{ date: string, value: number }} SeriesPoint */

/**
 * @typedef {Object} PostMetrics
 * @property {number|null} views
 * @property {number|null} reach
 * @property {number|null} likes
 * @property {number|null} comments
 * @property {number|null} shares
 * @property {number|null} saves
 * @property {number|null} engagementRate  percent
 * @property {number|null} avgWatchMs
 * @property {number|null} skipRate  percent
 */

/**
 * A post that is live on the platform.
 * @typedef {Object} PublishedPost
 * @property {string} id  stable id for this app (provider post id)
 * @property {string|null} platformPostId  the platform's own id, used by comments and automations
 * @property {string|null} url
 * @property {string} caption
 * @property {string|null} publishedAt
 * @property {"reel"|"post"|"carousel"|"story"|"video"} kind
 * @property {string|null} thumbnailUrl
 * @property {PostMetrics} metrics
 */

/**
 * @typedef {Object} PostPage
 * @property {PublishedPost[]} posts
 * @property {number} page
 * @property {number} pages
 * @property {number} total
 */

/**
 * A post managed through the app that is not live yet, or failed.
 * @typedef {Object} QueuedPost
 * @property {string} id
 * @property {string} caption
 * @property {"draft"|"scheduled"|"publishing"|"published"|"failed"|"partial"|"cancelled"|"pending_approval"} status
 * @property {string|null} scheduledFor
 * @property {string|null} updatedAt
 * @property {{ type: "image"|"video", url: string, thumbnail: string|null }[]} media
 * @property {string|null} error
 * @property {string|null} url
 * @property {PostOptions} options
 */

/**
 * @typedef {Object} PostOptions
 * @property {"reel"|"feed"|"story"} format
 * @property {string} firstComment
 * @property {string[]} collaborators
 * @property {boolean} shareToFeed
 * @property {boolean} commentsEnabled
 */

/**
 * Input to create or update a post.
 * @typedef {Object} PostInput
 * @property {string} accountId
 * @property {string} caption
 * @property {{ type: "image"|"video", url: string }[]} media
 * @property {PostOptions} options
 * @property {"now"|"schedule"|"queue"|"draft"} when
 * @property {string} [scheduledFor]  local wall time "YYYY-MM-DDTHH:mm"
 * @property {string} [timezone]
 * @property {string} [profileId]  for when = "queue"
 */

/** @typedef {{ weekday: number, hour: number, avgEngagement: number, posts: number }} BestTime  weekday 0 = Sunday, hour in UTC */

/** @typedef {{ at: string, value: number }} OnlineSample  followers online during the hour starting at `at` (UTC instant) */

/**
 * @typedef {Object} Demographics
 * @property {{ key: string, value: number }[]} country
 * @property {{ key: string, value: number }[]} city
 * @property {{ key: string, value: number }[]} age
 * @property {{ key: "male"|"female"|"unknown", value: number }[]} gender
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} accountId
 * @property {string} name
 * @property {string|null} username
 * @property {string|null} avatarUrl
 * @property {string} lastMessage
 * @property {string|null} updatedAt
 * @property {number} unread
 * @property {string|null} url
 * @property {"active"|"archived"} status
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} text
 * @property {"incoming"|"outgoing"} direction
 * @property {string} createdAt
 * @property {string|null} status  sent, delivered, read, failed
 * @property {"human"|"automation"|"api"|"other"} via
 * @property {string|null} automationId
 * @property {{ type: string, url: string|null }[]} attachments
 * @property {boolean} isStoryReply
 */

/**
 * @typedef {Object} CommentedPost
 * @property {string} id  platform post id
 * @property {string} caption
 * @property {string|null} thumbnailUrl
 * @property {string|null} url
 * @property {string|null} createdAt
 * @property {number} commentCount
 */

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} text
 * @property {string} createdAt
 * @property {{ id: string, username: string, name: string|null, avatarUrl: string|null, isOwner: boolean }} author
 * @property {number} likeCount
 * @property {number} replyCount
 * @property {Comment[]} replies
 * @property {boolean} hidden
 * @property {{ reply: boolean, delete: boolean, hide: boolean }} can
 * @property {string|null} url
 */

/**
 * @typedef {Object} Automation
 * @property {string|null} id
 * @property {string} name
 * @property {"comment"|"story_reply"|"story_mention"|"live_comment"} trigger
 * @property {string} accountId
 * @property {string|null} postId  platform post id, null = any post
 * @property {string|null} postTitle
 * @property {string[]} keywords
 * @property {"word"|"exact"|"contains"} matchMode
 * @property {string[]} excludeKeywords
 * @property {boolean} typoTolerance
 * @property {string} dmMessage
 * @property {{ title: string, url: string }|null} button
 * @property {boolean} linkTracking
 * @property {number} dmDelaySeconds
 * @property {string} commentReply
 * @property {"after_dm"|"always"} replyPolicy
 * @property {"any"|"follower"|"non_follower"} audience
 * @property {boolean} followGate
 * @property {boolean} oncePerPerson
 * @property {boolean} likeComment
 * @property {boolean} hideComment
 * @property {boolean} active
 * @property {{ triggered: number, dmsSent: number, failed: number, skipped: number, linkClicks: number, people: number }} stats
 * @property {string|null} createdAt
 */

/**
 * @typedef {Object} AutomationLog
 * @property {string|null} commentId
 * @property {{ id: string, username: string|null, name: string|null }} person
 * @property {string|null} text
 * @property {"pending"|"sent"|"failed"|"skipped"|"gated"} status
 * @property {string|null} error
 * @property {string|null} replyStatus
 * @property {number} clicks
 * @property {string} createdAt
 * @property {string} id
 */

/**
 * @typedef {Object} AutomationActivity
 * @property {AutomationLog[]} logs
 * @property {number} total
 * @property {boolean} hasMore
 * @property {{ total: number, days: number, samples: { text: string, username: string|null, at: string }[] }} misses
 */

/** @typedef {{ id: string, name: string, status: "draft"|"active"|"paused", started: number, completed: number }} Workflow */

export {};
