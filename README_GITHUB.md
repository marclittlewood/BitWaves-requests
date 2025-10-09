# Song Requests (Per‑IP) — GitHub Ready

A cleaned-up build of the Song Request app with:
- ✅ **Per‑IP limits** (4/hour, 20/day, rolling windows)
- ✅ **DigitalOcean App Platform** compatibility (Tailwind v4 PostCSS plugin for Parcel)
- ✅ Clean `server.ts` (type-safe, no stray returns), `Requests.ts` helpers, and `RequestProcessor` fix

## Environment Variables (required)
- `PLAYIT_LIVE_BASE_URL`
- `PLAYIT_LIVE_API_KEY`
- `ADMIN_PASSWORD`
- `REQUESTABLE_TRACK_GROUP_NAME`

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


## New: IP Blocklist (v1.4.0)
- Add, list, and remove blocked IPs in **Admin → Blocked IPs**.
- Block is enforced on `/api/requestTrack` before rate limits.
- Data persisted to `data/blocked_ips.json`. On DigitalOcean App Platform, this will persist **only while the container is running** unless you attach a persistent volume.

### Environment
No new env vars required. Ensure your admin auth is configured:
- `ADMIN_PASSWORD` (required)
- `JWT_SECRET` (optional; will auto-generate at boot if omitted, but tokens will invalidate on restart)

### DigitalOcean App Platform Notes
- Set **Build Command**: `npm install --prefix server && npm run build --prefix server`
- Set **Run Command**: `npm start --prefix server`
- Add an app-level **Persistent Volume** mounted at `/app/data` (or the runtime equivalent), then set `DATA_DIR=/app/data` and modify server to use it (we default to `../data`). If you keep defaults, ensure the relative `data/` path is writable.
- Set env vars: `PLAYIT_LIVE_BASE_URL`, `PLAYIT_LIVE_API_KEY`, `ADMIN_PASSWORD`, `MAX_REQUESTS_PER_HOUR`, `MAX_REQUESTS_PER_DAY` as needed.

