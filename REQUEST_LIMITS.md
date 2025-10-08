# Request Limits (Per IP)

This fork enforces **per-IP** request limits on the song request endpoint:

- **Max 4 requests per rolling hour**
- **Max 20 requests per rolling 24 hours**

If a client exceeds either limit, the server returns **HTTP 429** with a friendly JSON message.

## Configuration

Environment variables (optional; defaults shown):

```
MAX_REQUESTS_PER_HOUR=4
MAX_REQUESTS_PER_DAY=20
```

If you are behind a proxy/load balancer (NGINX, Cloudflare, etc.), the server is configured with `app.set('trust proxy', true)` and uses `X-Forwarded-For` where available to determine the real client IP.

## Files changed

- `server/Requests.ts`: Added rolling-window counters by IP (`getCountsByIp`) and ensured `requestedAt` and `ipAddress` are stored.
- `server/server.ts`: Added per-IP limiter for `/api/requestTrack`, helper to normalize client IP, and `.env`-configurable limits.
