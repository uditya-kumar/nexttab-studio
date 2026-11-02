# Nexttab Studio

A local desk for running the @nexttab Instagram account: schedule reels, read reach and audience, answer DMs and comments, and manage the comment-keyword automations that DM repo links.

## Setup

Needs Node 18.17 or newer.

```
npm install
npm run dev
```

Open http://localhost:5173 and paste your Zernio API key (Zernio dashboard, API keys). The key is checked, then saved to `.env` in this folder. You can also put it there yourself:

```
ZERNIO_API_KEY=your_key_here
```

For a production-style run on one port:

```
npm run build
npm start        # http://localhost:5177
```

## What is where

| Screen | What it does |
| --- | --- |
| Overview | Reach, views, engagement for 7, 30 or 90 days, daily reach, top posts, automations, latest DMs, scheduled posts |
| Analytics | All account metrics, totals by publish day, sortable post table with a per-post daily curve, when followers are online, best times, audience |
| Content | Published reels with their automation status, plus scheduled, draft and failed posts |
| New post | Upload or link media, caption, first comment, collaborators, schedule at a time, next queue slot, publish now or draft |
| Messages | Instagram DMs, reply, archive |
| Comments | Comments per post with keyword matches marked, reply, DM the commenter, hide, delete |
| Automations | Comment-to-DM automations with their flow and stats, pause, logs, unmatched comments, captions that still need an automation |
| Settings | API key, publishing limit, account health and permissions |

## Notes

- The server only answers requests from localhost, because it holds your key.
- All Zernio calls live in `server/providers/zernio/`. See `CLAUDE.md` for the architecture and `API_SPEC.md` for the Zernio endpoints.
- The UI design lives in `design/design.pen` (Pencil).
