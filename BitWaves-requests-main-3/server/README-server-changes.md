# Server changes (2 lines) to fix build/runtime

Make these exact edits in **server/server.ts**:

1) Add this helper **above** your routes (near imports is fine):

```ts
function getClientIp(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return (xff.split(',')[0] || '').trim() || req.socket.remoteAddress || req.ip || 'unknown';
}
```

2) In the `POST /api/requestTrack` handler, **before** calling `requests.addRequest(...)`, add:

```ts
const ipAddress = getClientIp(req);
```

3) Ensure the `addRequest` call has **four** arguments (no more):
```ts
await requests.addRequest(trackGuid, requestedBy, message, ipAddress);
```

> If your call currently has 5 args, remove the extra one so it’s exactly 4 as above.
