# Tasks

## Done

- [x] Read Zernio OpenAPI spec and write `API_SPEC.md`
- [x] Add Zernio MCP server
- [x] Scaffold Express + Vite/React project, install dependencies
- [x] Design all 10 screens in Pencil (`design/design.pen`)
- [x] Unslop audit and polish of every screen
- [x] Write `CLAUDE.md` with project decisions

## Server: provider boundary

- [x] `server/domain.js` app models, `server/errors.js`
- [x] `server/providers/zernio/client.js` (auth, fetch, error mapping)
- [x] Zernio provider: accounts, health, limits, usage
- [x] Zernio provider: analytics (insights, reach series, posts, best times, online followers, demographics)
- [x] Zernio provider: scheduled posts (list, get, create, update, delete, retry, publish now) and media upload
- [x] Zernio provider: inbox (conversations, messages, send, archive)
- [x] Zernio provider: comments (commented posts, comments, reply, private reply, hide, delete)
- [x] Zernio provider: automations (list, get, create, update, delete, logs) and workflows
- [x] `server/providers/index.js`
- [x] App routes in `server/routes/` and wire in `server/index.js`, remove the old pass-through proxy
- [ ] Smoke test every route against the live account (needs ZERNIO_API_KEY in .env)
- [x] Smoke test routes without a key (session, validation, host guard, 404)

## Frontend

- [x] `lib/api.js` and `lib/queries.js` on the new app endpoints and domain shapes
- [x] Shared UI updates from the unslop pass (Stat previous-period text, off-white checkboxes, heatmap scale)
- [x] `styles/pages.css`
- [x] Connect page
- [x] Overview page
- [x] Analytics page
- [x] Content page
- [x] New post / edit post page
- [x] Messages page
- [x] Comments page
- [x] Automations page
- [x] Automation editor page
- [x] Settings page

## Verify

- [x] `npm run build` passes
- [x] Run the app and compare each screen with the Pencil design (against a local mock of Zernio built from recorded live responses)
- [x] README with setup steps

- [x] Provider mappers checked against recorded live Zernio responses

## Automations at scale (20+)

- [x] Redesign in Pencil: summary strip, searchable list + detail, filters, bulk pause/resume, scrollbars
- [x] Clean detail header (no rules line)
- [x] Overview top posts with covers and compact views
- [x] Build in React and check in Chrome against a 20-automation mock

## Theme

- [x] Palette from linearDesignSystem.md / designToken.md (colors only), in code and Pencil
- [x] Light mode derived from the same palette, Light/Dark toggle under the account chip, no-flash load
- [x] Accent split: --accent (lime fills), --accent-fg (text, thin lines), --accent-fill (data), --chart-line
- [x] Depth per unslop tokens: dark top highlight + hairlines, light small soft shadows, flat keycaps
- [ ] Light mode variant of the screens in Pencil

## Next

- [ ] Add ZERNIO_API_KEY to .env and run the live smoke test
- [ ] Try one write end to end on the live account: pause and resume an automation, schedule a draft, reply to a comment

## Notes

- Zernio automation stats have no "public replies" count. The Automations stat strip shows Skipped instead (from `audienceSkipped`).
- Follower history is empty for this account so far; Overview uses the current follower count.
