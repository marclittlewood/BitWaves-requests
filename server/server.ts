import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import bodyParser from 'body-parser';
import { Requests } from './Requests';
import { RequestAgent } from './RequestAgent';
import { RequestProcessor } from './RequestProcessor';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const PLAYIT_LIVE_BASE_URL = process.env.PLAYIT_LIVE_BASE_URL || '';
const PLAYIT_LIVE_API_KEY = process.env.PLAYIT_LIVE_API_KEY || '';
const REQUESTABLE_TRACK_GROUP_NAME = process.env.REQUESTABLE_TRACK_GROUP_NAME || '';

const requests = new Requests();
const requestAgent = new RequestAgent(PLAYIT_LIVE_BASE_URL, PLAYIT_LIVE_API_KEY, REQUESTABLE_TRACK_GROUP_NAME);
new RequestProcessor(requests, requestAgent);

// Helpers
function getClientIp(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return (xff.split(',')[0] || '').trim() || (req.socket && (req.socket as any).remoteAddress) || (req as any).ip || 'unknown';
}

// Health
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Public: submit a track request
app.post('/api/requestTrack', async (req: Request, res: Response) => {
  try {
    const { trackGuid, requestedBy, message } = req.body || {};
    if (!trackGuid) {
      return res.status(400).json({ success: false, message: 'trackGuid is required' });
    }
    // Inline client IP (no separate variable needed elsewhere)
    const ip = getClientIp(req);

    // (Optional) rate limiting & cooldown checks would be inside Requests if implemented.
    await requests.addRequest(trackGuid, requestedBy, message, ipAddress);
    requests.addRequest(trackGuid, requestedBy || '', message || '', ip);
    return res.json({ success: true });
  } catch (e: any) {
    console.error('requestTrack error', e);
    return res.status(500).json({ success: false, message: 'Failed to submit request' });
  }
});

// Admin auth (very simple header-based)
app.use('/api', (req, res, next) => {
  if (req.path === '/requestTrack') return next();
  const auth = req.headers['x-admin-key'] || req.headers['x-admin-password'];
  if (auth && String(auth) === ADMIN_PASSWORD) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized' });
});

// Admin: list requests
app.get('/api/requests', async (_req, res) => {
  const all = await requests.getAll();
  res.json({ success: true, data: all });
});

// Admin: hold
app.post('/api/requests/:id/hold', async (req, res) => {
  const ok = await requests.holdRequest(req.params.id);
  res.json({ success: ok });
});

// Admin: unhold
app.post('/api/requests/:id/unhold', async (req, res) => {
  const ok = await requests.unholdRequest(req.params.id);
  res.json({ success: ok });
});

// Admin: process now
app.post('/api/requests/:id/process', async (req, res) => {
  const ok = await requests.forceProcessNow(req.params.id);
  res.json({ success: ok });
});

// Admin: delete
app.delete('/api/requests/:id', async (req, res) => {
  const ok = await requests.deleteRequest(req.params.id);
  res.json({ success: ok });
});

// Serve client (assumes Parcel outputs to client/dist)
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
