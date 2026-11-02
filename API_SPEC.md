# Zernio API — working spec for Nexttab Studio

Reference for every Zernio endpoint this project uses, with the shapes seen in live responses for @nexttab on 2026-11-02. Source of truth is the OpenAPI spec at `https://zernio.com/openapi.json` (v1.432.1, 761 paths) and the docs index at `https://docs.zernio.com/llms.txt`.

## Basics

| | |
| --- | --- |
| Base URL | `https://zernio.com/api/v1` (OpenAPI server `https://zernio.com/api` + paths starting `/v1`) |
| Auth | `Authorization: Bearer <ZERNIO_API_KEY>` |
| Body | JSON, `Content-Type: application/json` |
| Idempotency | Optional `Idempotency-Key: <uuid>` header on `POST /v1/posts`, `POST /inbox/.../messages`, `POST /inbox/comments/{postId}` |
| CORS | Not guaranteed for browser calls. Call from a server. This project proxies through `server/` and keeps the key in `.env` |

### Error envelope

```json
{ "error": "Human readable message", "type": "invalid_request_error|authentication_error|permission_error|not_found|rate_limit_error|platform_error|api_error", "code": "stable_code", "param": "field", "platform": "instagram", "platformError": { }, "docUrl": "..." }
```

- 401 bad key, 402 `payment_required`, 404 not found, 429 rate limited (honour `Retry-After`), 424 all platforms failed (single post analytics), 202 analytics sync pending.
- Rate limits scale with connected account count; analytics also has a per-second window.

### Known IDs (this account)

| What | ID |
| --- | --- |
| Profile | `6ae7901c166768c4344ed576` |
| Instagram account (@nexttab, "Next Tab") | `6ae7906b7d8aaaab677e9100` |
| Comment automation "AlterSend Reel — SEND repo link" | `6ae843497d3010f4451ca4ec` |
| AlterSend reel platformPostId | `17912713494311107` |

These are discovered at runtime from `GET /accounts` and `GET /profiles`. Never hardcode them in app code.

### Conventions seen in responses

- Dates: `YYYY-MM-DD` for analytics ranges. Timestamps are ISO 8601 (comments use `+0000` offsets, others `Z`).
- Instagram post IDs come in two kinds. Zernio `_id` (24 hex chars) and Instagram `platformPostId` (numeric string, ~17 digits). Inbox comment endpoints take either.
- Lists use either cursor paging `{ pagination: { hasMore, nextCursor } }` (inbox) or skip/limit `{ pagination: { total, limit, skip, hasMore } }` (automations, workflows) or page paging `{ pagination: { page, limit, total, pages } }` (analytics).

---

## Accounts and profiles

### GET /accounts
Query: `profileId`, `platform=instagram`, `status=connected|disconnected`, `search`, `page`, `limit`, `cursor`.
Response: `{ accounts: [Account], hasAnalyticsAccess, pagination }`.
Account (from analytics `accounts[]`): `{ _id, platform, username, displayName, profilePicture, profileId, followersCount, followersLastUpdated }`.

### GET /profiles
Response: `{ profiles: [{ _id, name, ... }] }`.

### GET /accounts/{accountId}/health
Response:
```
{ accountId, platform, username, displayName, status: healthy|warning|error,
  tokenStatus: { valid, expiresAt, expiresIn, needsRefresh },
  permissions: { posting:[{scope,granted,required}], analytics:[...], optional:[...], canPost, canFetchAnalytics, missingRequired:[string] },
  issues:[string], recommendations:[string],
  analyticsSync: { status: ok|failing|stalled|never_synced, lastSyncedAt },
  messagingRestriction: { code, subcode, message, pausedUntil },
  sendCap: { limit, used, resetsAt } }
```

### GET /accounts/follower-stats
Query: `accountIds` (comma list), `profileId`, `fromDate`, `toDate`, `granularity=daily|weekly|monthly`.
Response: `{ accounts:[...], stats: { [accountId]: ... }, dateRange:{from,to}, granularity }`.

### GET /accounts/{accountId}/posts
Live list straight from Instagram. Response: `{ status, posts:[{ id, platform, message, createdTime, permalink, picture, mediaType, commentCount, likeCount, shareCount }] }`.

### GET /accounts/{accountId}/instagram/publishing-limit
Response: `{ quotaUsage, quotaTotal, quotaDurationSeconds }`. Instagram allows a fixed number of API publishes per 24 h.

### GET /accounts/{accountId}/instagram/stories
Active stories. Response: `{ data:[{ id, mediaType, mediaProductType, mediaUrl, permalink, thumbnailUrl, timestamp }] }`.

### GET /accounts/{accountId}/instagram/stories/{storyId}/insights
Story metrics, `source: live|cached|unavailable`.

---

## Analytics

### GET /analytics/instagram/account-insights
Query: `accountId`*, `metrics` (comma), `fromDate`, `toDate` (max 90 days, default 30), `metricType=total_value|time_series`, `breakdown`.
Valid metrics: `reach, views, accounts_engaged, total_interactions, comments, likes, saves, shares, replies, reposts, follows_and_unfollows, profile_links_taps, profile_views, website_clicks`.
Only `reach` supports `time_series`. Data delayed up to 48 h.

Live sample, total_value:
```json
{ "success": true, "accountId": "...", "platform": "instagram",
  "dateRange": { "since": "2026-10-03", "until": "2026-11-02" }, "metricType": "total_value",
  "metrics": { "reach": { "total": 236798 }, "views": { "total": 371226 }, "accounts_engaged": { "total": 27607 },
               "total_interactions": { "total": 43235 }, "profile_views": { "total": 1761 }, "website_clicks": { "total": 0 } },
  "unavailableMetrics": [{ "metric": "...", "reason": "no_data|permission_missing|...", "message": "..." }],
  "dataDelay": "Data may be delayed up to 48 hours" }
```
Live sample, reach time_series: `metrics.reach = { total: 293932, values: [{ date: "2026-10-16", value: 12819 }, ...] }`.
Note: the time_series total (293,932) differs from total_value reach (236,798) because total_value is deduplicated across the period. Show total_value as the headline figure.

### GET /analytics/instagram/follower-history
Query: `accountId`*, `metrics` (`follower_count,followers_gained,followers_lost`), `fromDate`, `toDate` (max 89 days), `metricType`.
Same envelope as account-insights. For @nexttab it currently returns empty `values` (snapshotter just started), so the UI must handle an empty series. Current count lives in `Account.followersCount` (2,403).

### GET /analytics/instagram/demographics
Query: `accountId`*, `metric=follower_demographics|engaged_audience_demographics`, `breakdown=age,city,country,gender`, `timeframe=this_week|this_month`.
Response: `{ demographics: { country:[{dimension:"IN",value:266}], age:[{dimension:"25-34",value:592}], gender:[{dimension:"M",value:1197},{dimension:"F"},{dimension:"U"}], city:[...] }, note }`. Top 45 per dimension, unsorted, needs 100+ followers.

### GET /analytics/instagram/online-followers
Response: `{ days: [{ endTime: "2026-10-04T07:00:00+0000", hours: { "0": 3, "1": 3, ... "23": 4 } }] }`. Hours are keyed 0 to 23, missing keys mean 0. About 30 days.

### GET /analytics  (post analytics)
Query: `postId`, `platform`, `profileId`, `accountId`, `source=all|late|external`, `fromDate`, `toDate` (default 90 days, max 366), `limit` (default 50), `page`, `sortBy=date|engagement|impressions|reach|likes|comments|shares|saves|clicks|views|...`, `order=asc|desc`.
List response:
```
{ overview: { totalPosts, publishedPosts, scheduledPosts, lastSync, dataStaleness:{ staleAccountCount, syncTriggered } },
  posts: [{ _id, latePostId, content, publishedAt, scheduledFor, status, isExternal, isAd, profileId,
            platform, platformPostUrl, thumbnailUrl, mediaType: video|image|carousel|text, mediaProductType: "REELS"|"FEED"|...,
            analytics: { impressions, reach, likes, comments, shares, saves, clicks, views, follows,
                         igReelsAvgWatchTime (ms), igReelsVideoViewTotalTime (ms), reelsSkipRate (%), completionRate,
                         profileViews, websiteClicks, replays, reposts, videoDurationSeconds, engagementRate (%), lastUpdated },
            platforms: [{ platform, status, platformPostId, accountId, accountUsername, analytics, syncStatus, platformPostUrl, errorMessage }],
            mediaItems: [{ type, url, thumbnail }] }],
  pagination: { page, limit, total, pages },
  accounts: [Account], hasAnalyticsAccess }
```
Single post (`postId=`): flat object with `analytics`, `platformAnalytics[]`, `syncStatus`. May return 202 while syncing.
Sample: AlterSend reel 120,742 views, 96,088 reach, 3,626 likes, 800 comments, 2,717 shares, 6,198 saves, engagementRate 11.05.
Thumbnails are Instagram CDN URLs that expire (`oe=` param). Do not cache them long term.

### GET /analytics/daily-metrics
Query: `platform`, `accountId`, `fromDate`, `toDate` (default 180 days), `source`, `attribution=publish|received`.
Response: `{ dailyData:[{ date, postCount, platforms:{instagram:n}, metrics:{ impressions, reach, likes, comments, shares, saves, clicks, views } }], platformBreakdown:[...] }`.
Use `attribution=received` for engagement over time.

### GET /analytics/best-time
Query: `platform`, `accountId`, `source`.
Response: `{ slots:[{ day_of_week: 0-6 (0 = Sunday), hour: 0-23 (UTC), avg_engagement, post_count }] }`. Sorted by avg_engagement desc. Only slots with posts appear.

### GET /analytics/post-timeline
Query: `postId`*, `fromDate`, `toDate`. Response: `{ postId, timeline:[{ date, impressions, reach, likes, comments, shares, saves, views, ... }] }`. Daily growth of one post.

### Also available, not used yet
`/analytics/content-decay`, `/analytics/posting-frequency`, `/analytics/dashboard`, `/analytics/delta`, `/analytics/inbox/{volume,heatmap,response-time,source-breakdown,top-accounts,conversations}`.

---

## Posts (publishing)

### GET /posts
Query: `page`, `limit`, `cursor`, `status=draft|pending_approval|scheduled|publishing|published|partial|failed|cancelled`, `platform`, `profileId`, `accountId`, `fromDate`, `toDate`, `search`, `sortBy=scheduled-desc|scheduled-asc|created-desc|created-asc|status|platform`.
Response: `{ posts:[Post], pagination:{ ..., nextCursor } }`.
Only posts authored through Zernio (`source=zernio`). @nexttab has none yet, so empty lists are normal. Externally published posts appear in `GET /analytics` instead.

Post: `{ _id, title, content, mediaItems:[], platforms:[{ platform, accountId, status, platformPostId, platformPostUrl, errorMessage }], scheduledFor, timezone, status, tags, hashtags, createdAt, updatedAt }`.

### POST /posts
```json
{ "content": "Caption",
  "mediaItems": [{ "type": "video", "url": "https://.../file.mp4" }],
  "platforms": [{ "platform": "instagram", "accountId": "<id>",
                  "platformSpecificData": { "contentType": "story", "shareToFeed": true, "firstComment": "...", "collaborators": ["user"], "thumbOffset": 0, "commentsEnabled": true } }],
  "scheduledFor": "2026-11-05T12:00:00", "timezone": "Asia/Kolkata",
  "publishNow": false, "isDraft": false, "tags": ["altersend"], "dryRun": false }
```
- Exactly one of: `publishNow: true`, `scheduledFor` (+ `timezone`), `isDraft: true`, or `queuedFromProfile: <profileId>` (next queue slot).
- Instagram needs at least one media item. A single video becomes a Reel, images become feed posts, several items become a carousel. `contentType: "story"` publishes a Story.
- Response: `{ message, post, warnings:[string] }`.

### PUT /posts/{postId}
Same body fields, for draft or scheduled posts.

### DELETE /posts/{postId}
Deletes a Zernio post (scheduled or draft). For published posts use `POST /posts/{postId}/unpublish`.

### POST /posts/{postId}/retry
Retry a failed post.

### POST /posts/{postId}/edit
Edit a published post (caption only, where the platform allows).

### POST /tools/validate/post
Validate content and media before posting. `POST /tools/validate/post-length` for caption length.

### Media upload: POST /media/presign
Body: `{ filename, contentType: "image/jpeg|image/png|image/webp|video/mp4|video/quicktime|...", size }`.
Response: `{ uploadUrl, publicUrl, key, expiresIn }`.
Then `PUT` the raw file bytes to `uploadUrl` with the same `Content-Type`, and use `publicUrl` as `mediaItems[].url`.

### Queue
- `GET /queue/slots?profileId=` → `{ exists, schedule, nextSlots:[iso] }` or with `all=true` `{ queues, count }`.
- `GET /queue/next-slot?profileId=` → `{ profileId, nextSlot, timezone, queueId, queueName }`.
- `GET /queue/preview?profileId=` upcoming slots.
- `POST|PUT|DELETE /queue/slots` manage the schedule.

---

## Inbox: DMs

### GET /inbox/conversations
Query: `accountId`, `platform=instagram`, `status=active|archived`, `folder=inbox|requests`, `sortOrder`, `limit` (≤100), `cursor`.
Response:
```
{ data: [{ id, accountId, accountUsername, platform, participantId, participantName, participantUsername, participantPicture,
           lastMessage, updatedTime, status, unreadCount, url, instagramProfile:{ isFollower, isFollowing, followerCount, isVerified } }],
  pagination: { hasMore, nextCursor }, meta: { accountsQueried, accountsFailed, failedAccounts } }
```
`participantName` can be `"Instagram User"` and `participantPicture` is often null. Fall back to initials.

### GET /inbox/conversations/{conversationId}/messages
Query: `accountId`*, `limit` (≤100), `cursor`, `sortOrder` (default asc, oldest first).
Message: `{ id, message, senderId, senderName, direction: incoming|outgoing, createdAt, attachments:[], deliveryStatus: sent|delivered|read|failed, isStoryMention, storyReply, isDeleted, sentVia: human|api|comment_automation|workflow|..., metadata:{ automationId } }`.

### POST /inbox/conversations/{conversationId}/messages
Body: `{ accountId, message, attachmentUrl?, attachmentType?: image|video|audio|file, quickReplies?, buttons?:[{type:"url",title,url}] }`.
Response: `{ success, data:{ messageId, conversationId } }`. Instagram only allows sends inside the 24 h window after the user's last message.

### PUT /inbox/conversations/{conversationId}
Body: `{ accountId, status: active|archived }`.

### POST /inbox/conversations/{conversationId}/read
Mark read.

---

## Inbox: comments

### GET /inbox/comments
Posts that have comments. Query: `accountId`, `platform=instagram`, `sortBy=date|comments`, `sortOrder`, `limit`, `cursor`, `minComments`.
Response: `{ data:[{ id (platformPostId), accountId, content, picture, permalink, createdTime, commentCount, likeCount }], pagination:{ hasMore, nextCursor } }`.

### GET /inbox/comments/{postId}
Query: `accountId`*, `limit`, `cursor`, `commentId` (to load replies).
Response:
```
{ comments: [{ id, message, createdTime, from:{ id, name, username, picture, isOwner }, likeCount, replyCount, url,
               replies:[...], isHidden, canReply, canDelete, canHide, canLike, isLiked, canPin, isPinned }],
  pagination: { hasMore, cursor }, post: { id, permalink, text, thumbnailUrl, mediaType, productType, createdAt } }
```
Newest first. Owner replies (`from.isOwner: true`) are mixed in.

### POST /inbox/comments/{postId}
Reply publicly. Body: `{ accountId, message, commentId }` (commentId = the comment being answered; omit to comment on the post).

### DELETE /inbox/comments/{postId}?accountId=&commentId=
Only own comments or where `canDelete`.

### POST|DELETE /inbox/comments/{postId}/{commentId}/hide
Body `{ accountId }`. Response `{ status, commentId, hidden }`.

### POST /inbox/comments/{postId}/{commentId}/private-reply
Send a DM to the commenter. Body: `{ accountId, message, buttons? }`. One private reply per comment, within 7 days.

### Also: like / pin
`POST|DELETE /inbox/comments/{postId}/{commentId}/like`, `.../pin` (Instagram reports `canLike: false` on these).

### GET /inbox/mentions
Query `accountId`, `limit`, `cursor`. Response `{ data:[{ id, type: caption|comment, mediaId, commentId, content, permalink, authorUsername, publishedAt }], pagination }`.

---

## Comment automations (comment to DM)

### GET /comment-automations
Query `profileId`. Response `{ success, automations:[Automation] }`.

Automation (live):
```json
{ "id": "6ae843497d3010f4451ca4ec", "name": "AlterSend Reel — SEND repo link", "platform": "instagram", "trigger": "comment",
  "accountId": "6ae7906b7d8aaaab677e9100", "platformPostId": "17912713494311107", "postTitle": "AlterSend — file sharing",
  "keywords": ["SEND"], "matchMode": "word", "commentReply": "Check your DM", "repeatPolicy": { "mode": "once" },
  "linkTracking": true, "dmMessage": "Repo link:- https://github.com/denislupookov/altersend", "publicReplyPolicy": "after_dm",
  "audience": { "whenUnknown": "send", "followerStatus": "any" }, "alsoMatchInDms": false, "isActive": true,
  "stats": { "triggered": 2, "dmsSent": 2, "dmsFailed": 0, "delivered": 0, "read": 0, "linkClicks": 0, "trackedSends": 0,
             "uniqueClicks": 0, "uniqueContacts": 2, "audienceSkipped": 0, "followGateSent": 0, "followGatePassed": 0, "followGateFailed": 0 },
  "createdAt": "...", "updatedAt": "..." }
```

Field meanings:
- `trigger`: `comment | live_comment | story_reply | story_mention`. Story triggers have no `platformPostId`.
- `platformPostId` null/omitted on a comment trigger = applies to every post on the account.
- `keywords` + `matchMode`: `exact` (whole comment equals keyword), `word` (keyword appears as a whole word), `contains` (substring). Empty keywords match every comment.
- `excludeKeywords`, `typoTolerance`.
- `dmMessage`, `dmMessageVariations[]` (rotated), `buttons[]` ({type:url|postback|phone,title,url}), `quickReplies[]`, `dmMedia`, `template`.
- `commentReply`, `commentReplyVariations[]`, `publicReplyPolicy: after_dm | always`.
- `dmDelaySeconds`, `commentReplyDelaySeconds`.
- `linkTracking` + `clickTag`: wraps links to count clicks.
- `audience: { followerStatus: any|follower|non_follower, minFollowerCount, whenUnknown: send|skip|verify, tapToUnlock }`.
- `followGate: { message, buttonLabel, profileButtonLabel, notFollowingMessage }`: asks non-followers to follow before sending.
- `repeatPolicy: { mode: once|every_comment, cooldownHours }`, `dedupeSameTextHours`.
- `actions: { likeComment, hideComment }`.
- `alsoMatchInDms`: keyword in a DM also triggers.

### POST /comment-automations
Body: `{ profileId, accountId, trigger, platformPostId, postTitle, name, keywords, matchMode, dmMessage, commentReply, ... , isActive }`.
Response `{ success, automation }`.

### GET /comment-automations/{id}
Same object.

### PATCH /comment-automations/{id}
Any subset of the fields above (plus `isActive` to pause or resume). Response `{ success, automation }`.

### DELETE /comment-automations/{id}

### GET /comment-automations/{id}/logs
Query: `status=pending|sent|failed|skipped|gated`, `limit`, `skip`.
Response:
```
{ logs: [{ id, commentId, commenterId, commenterName, commenterUsername, commentText, source, status,
           error, platformError:{code,subcode}, commentReplyStatus, commentReplyError, publicReplyPostedAt,
           audienceOutcome, commenterIsFollower, clickedAt, clickCount, createdAt }],
  pagination: { total, limit, skip, hasMore },
  misses: { total, retentionDays: 14, samples:[{ commentText, commenterName, excludedBy, at }] } }
```
`misses` are comments on the post that did not match a keyword. Useful for spotting keywords to add (live sample: "What about now").

---

## Workflows (multi-step automations)

- `GET /workflows?status=draft|active|paused&limit&skip` → `{ workflows:[{ id, name, description, platform, accountId, accountName, status, nodeCount, totalStarted, totalCompleted, totalExited, createdAt }], pagination }`.
- `GET /workflows/{id}` graph, `POST /workflows/{id}/activate`, `POST /workflows/{id}/pause`, `GET /workflows/{id}/executions`, `DELETE /workflows/{id}`.
- Creating workflows means building a node graph. Out of scope for this UI; link to the Zernio dashboard instead.

---

## Usage and account

- `GET /usage-stats` → `{ planName, billingPeriod, hasAccess, limits:{ uploads, profiles }, usage:{ uploads, profiles, connectedAccounts, lastReset }, spend:{ currentPeriodCents, creditsRemainingCents } }`.
- `GET /logs` activity log.
- `GET /webhooks/settings`, `POST /webhooks/test`.

---

## Gotchas

1. Browser CORS: call the API through the local server, never from the page with the key.
2. Instagram CDN images expire. Re-fetch rather than store.
3. `follower-history` may be empty for new connections. Fall back to `followersCount`.
4. Only `reach` has a daily series in account insights. Other daily figures come from `daily-metrics` (post attributed).
5. `best-time` hours are UTC. Convert to local for display.
6. DMs can only be sent within 24 h of the person's last message (Meta rule). Surface the send error text as is.
7. A comment automation with `publicReplyPolicy: after_dm` only posts the public reply when the DM succeeded.
8. Instagram API publishing is capped per 24 h. Read `/instagram/publishing-limit` before scheduling many posts.
