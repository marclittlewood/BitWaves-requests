# Song Requests (Per-IP Limited) – GitHub Ready

This repository is a **clean, GitHub-ready** version of the Song Request App with:

✅ **Per-IP rate limits**
- 4 requests/hour and 20/day (rolling windows)
- Returns HTTP 429 when exceeded

✅ **DigitalOcean compatibility fix**
- Tailwind v4 PostCSS plugin enabled for Parcel builds

### Quick Deploy (DigitalOcean / Docker)

1. Add these env vars:
   ```bash
   PLAYIT_LIVE_BASE_URL=...
   PLAYIT_LIVE_API_KEY=...
   ADMIN_PASSWORD=...
   REQUESTABLE_TRACK_GROUP_NAME=...
   MAX_REQUESTS_PER_HOUR=4
   MAX_REQUESTS_PER_DAY=20
   ```

2. Build + run
   ```bash
   npm ci --prefix server
   npm ci --prefix client
   npm run build --prefix server
   npm start --prefix server
   ```

---
© BitWaves / Marc Littlewood
