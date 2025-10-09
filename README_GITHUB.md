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


## IP Blocklist (Admin)
- Add / remove IPs under **Admin → Blocked IPs**
- Enforced in `/api/requestTrack` before rate-limits
- Persisted to `data/blocked_ips.json` (mount a volume and set `DATA_DIR` for persistence)

### DigitalOcean App Platform
- **Build Command:** `npm install --prefix server && npm run build --prefix client`
- **Run Command:** `npm start --prefix server`
- Set env vars in the dashboard (do not commit secrets)
