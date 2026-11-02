# Nexttab Studio

Instagram publishing, analytics, inbox and comment-to-DM automation desk for @nexttab. Reels about open-source tools; captions say `Comment "KEYWORD"` and an automation DMs the repo link.

Track work in `tasklist.md`. Tick items as they are finished.

## Run

```
npm install
npm run dev      # Express on :5177 + Vite on :5173 (open 5173)
npm run build && npm start   # production: Express serves dist/ on :5177
```

The API key lives in `.env` as `ZERNIO_API_KEY` (or is pasted in the app, which writes `.env`). Never commit `.env`.

## Architecture decisions

1. **The social API is behind a provider boundary.** Every call to Zernio lives in `server/providers/zernio/`. Nothing outside that folder knows Zernio URLs, field names or response shapes. Routes call `provider.<area>.<fn>()` from `server/providers/index.js` and get app domain models back (see `server/domain.js`). To switch providers, write `server/providers/<new>/` with the same exported functions and change one line in `server/providers/index.js`.
2. **The browser never talks to the provider.** React calls the app API under `/api/*` (`server/routes/`). No generic pass-through proxy. The key stays on the server.
3. **Domain models are ours.** Shapes are defined in `server/domain.js` (JSDoc). Provider mappers convert into them. React code reads only these shapes. If a provider lacks a field, return `null`, never invent it.
4. **Local only.** The server binds to 127.0.0.1 and rejects requests whose Host or Origin is not localhost, since it holds a key.
5. **Stack.** Express 5 server, Vite + React 19 frontend in `web/`, TanStack Query for data, react-router, lucide-react icons. No CSS framework; plain CSS with tokens in `web/src/styles/tokens.css`.
6. **Design source.** Screens are designed in Pencil first: `design/design.pen` (covers in `design/covers/`, audits in `design/audit-*`). Code matches the Pencil screens. Change the design there before large UI changes.
7. **UI rules (unslop skill, `../unslop/skills/unslop`).** Graphite neutral ramp, one amber accent `#f5a524` used rarely (primary action, live state, the one key figure, keycaps). Geist + Geist Mono. 4px spacing grid, weights 400/500, sentence case, no emoji, no exclamation marks, no trailing periods on labels, tabular numbers in one format. Signature: keycaps for comment keywords. The logo is the wordmark only. Checkboxes are off-white, not accent.
8. **Honest numbers.** Show only data the provider returns. When the previous period is 0 or tiny, state the previous figure ("0 in the previous 30 days") instead of a percentage. Times from the provider in UTC are converted to the viewer's time zone in the browser.

## Layout

```
server/
  index.js            app, localhost guard, static dist
  config.js           .env load/write
  domain.js           app data models (JSDoc typedefs)
  errors.js           AppError
  routes/             app API (/api/*), provider-agnostic
  providers/
    index.js          picks the active provider
    zernio/           the only place that knows Zernio
web/src/
  lib/api.js          fetch wrapper for /api/*
  lib/queries.js      TanStack Query hooks, one per app endpoint
  components/         shared UI (ui.jsx, charts.jsx, Sidebar, Toast)
  pages/              one file per screen
  styles/             tokens, base, components, pages
API_SPEC.md           Zernio reference (for provider work only)
```

## Conventions

- Dates sent to the server as `YYYY-MM-DD`. Timestamps are ISO strings.
- Errors from routes are `{ error, code }` with a meaningful HTTP status. The UI shows `error` as is.
- Writes from the UI go through `useAction` (toast + cache invalidation).
- Destructive actions ask for confirmation (`useConfirm`).
