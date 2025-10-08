# Request Limits & DO Build Fix

- Enforces **per-IP** limits: **4/hour** and **20/24h** (rolling windows). Returns HTTP 429 when exceeded.
- DigitalOcean App Platform build fix for Tailwind v4/Parcel:
  - Added PostCSS plugin config in `client/package.json`:
    ```json
    {"postcss": {"plugins": {"@tailwindcss/postcss": {}}}}
    ```
  - `client/src/index.css` imports Tailwind via `@import "tailwindcss";`

Optional env vars:
```
MAX_REQUESTS_PER_HOUR=4
MAX_REQUESTS_PER_DAY=20
```
