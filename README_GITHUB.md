# Song Requests (Per‑IP) — GitHub Ready

A cleaned-up build of the Song Request app with:
- ✅ **Per‑IP limits** (4/hour, 20/day, rolling windows)
- ✅ **DigitalOcean App Platform** compatibility (Tailwind v4 PostCSS plugin for Parcel)
- ✅ Clean `server.ts` (type-safe, no stray returns), `Requests.ts` helpers, and `RequestProcessor` fix
- ✅ Optional **request sweepers**: a random sweeper from a PlayIt Track Group is substituted immediately before an actually requested song

## Environment Variables (required)
- `PLAYIT_LIVE_BASE_URL`
- `PLAYIT_LIVE_API_KEY`
- `ADMIN_PASSWORD`
- `REQUESTABLE_TRACK_GROUP_NAME`

**Optional request-sweeper variables**:
- `REQUEST_SWEEPER_TRACK_GROUP_NAME` — exact PlayIt Track Group containing request sweepers
- `REQUEST_SWEEPER_PLACEHOLDER_TRACK_NAME` — defaults to `Request Sweeper Placeholder`

See `REQUEST_SWEEPER_SETUP.md` for the required PlayIt clock layout and supplied silent placeholder WAV.

**Optional limits** (defaults shown):
```
MAX_REQUESTS_PER_HOUR=4
MAX_REQUESTS_PER_DAY=20
```

## Build & Run (local)
```bash
npm ci --prefix server
npm ci --prefix client
npm run build --prefix server
npm start --prefix server
```

## Deploy on DigitalOcean App Platform
- **Build Command**:
  ```
  npm ci --prefix server && npm ci --prefix client && npm run build --prefix server
  ```
- **Run Command**:
  ```
  npm start --prefix server
  ```
- Ensure the env vars above are set in the App settings.
- The app listens on `PORT` (provided by DO). We also set `app.set('trust proxy', true)` for correct client IPs behind proxies.

---
Happy requesting!
