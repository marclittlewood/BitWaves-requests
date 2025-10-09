import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { Tracks } from './Tracks';
import { Requests } from './Requests';
import { PlayItLiveApiClient } from './PlayItLiveApiClient';
import { RequestProcessor } from './RequestProcessor';
import { RequestAgent } from "./RequestAgent";
import { BlockedIPs } from './BlockedIPs';
import { authenticateJWT, login } from './auth';
import { SettingsDto } from '../shared/SettingsDto';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

const dataDir = process.env.DATA_DIR ? process.env.DATA_DIR : path.join(__dirname, '../data');
const blockedIPs = new BlockedIPs(dataDir);


const PORT = Number(process.env.PORT || 3000);
const MAX_REQUESTS_PER_HOUR = Number(process.env.MAX_REQUESTS_PER_HOUR || 4);
const MAX_REQUESTS_PER_DAY  = Number(process.env.MAX_REQUESTS_PER_DAY  || 20);
const MAX_MESSAGE_LENGTH = 150;

const requiredEnvVars = ['PLAYIT_LIVE_BASE_URL', 'PLAYIT_LIVE_API_KEY'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: ${varName} is required but not set`);
  }
});

const playItLiveBaseUrl = process.env.PLAYIT_LIVE_BASE_URL!;
const playItLiveApiKey = process.env.PLAYIT_LIVE_API_KEY!;
const requestableTrackGroupName = process.env.REQUESTABLE_TRACK_GROUP_NAME;

const playItLiveApiClient = new PlayItLiveApiClient(playItLiveBaseUrl, playItLiveApiKey);
const tracks = new Tracks(playItLiveApiClient, requestableTrackGroupName);
tracks.init();

const requests = new Requests();
requests.init();

const requestAgent = new RequestAgent(playItLiveApiClient, tracks);
const requestProcessor = new RequestProcessor(requests, requestAgent);

function getClientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const raw = xff ?? req.socket.remoteAddress ?? (req as any).ip ?? '';
  const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  return ip || 'unknown';
}

// Routes
app.get('/api/tracks', (req, res) => {
  res.json(tracks.getRequestableTracks());
});

app.get('/api/settings', (req, res) => {
  const settings: SettingsDto = { maxMessageLength: MAX_MESSAGE_LENGTH };
  res.json(settings);
});

app.post('/api/requestTrack', async (req: Request, res: Response) => {
  try {
    const { trackGuid, requestedBy, message } = req.body || {};
    const clientIp = getClientIp(req);

    if (blockedIPs.isBlocked(clientIp)) { res.status(403).json({ success: false, message: 'Requests from your network are temporarily disabled.' }); return; }

    const messageString = (message ?? '').toString();
    const trimmedMessage = messageString.slice(0, MAX_MESSAGE_LENGTH);

    if (!trackGuid || !requestedBy) {
      res.status(400).json({ success: false, message: 'Track GUID and requester name are required' });
      return;
    }

    const { perHour, perDay } = await requests.getCountsByIp(clientIp);
    if (perHour >= MAX_REQUESTS_PER_HOUR) {
      res.status(429).json({ success: false, message: `Per-IP limit reached: max ${MAX_REQUESTS_PER_HOUR} requests per hour.` });
      return;
    }
    if (perDay >= MAX_REQUESTS_PER_DAY) {
      res.status(429).json({ success: false, message: `Per-IP limit reached: max ${MAX_REQUESTS_PER_DAY} requests per 24 hours.` });
      return;
    }

    await requests.addRequest(trackGuid, requestedBy, trimmedMessage, clientIp);
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/login', login);


app.get('/api/requests', authenticateJWT, async (req, res) => {
  try {
    const status = (req.query.status as string) || 'unprocessed'; // 'unprocessed' | 'processed' | 'all'
    const limit = Number(req.query.limit || 200);

    const all = await requests.getRequests();

    let list = all;
    if (status === 'unprocessed') {
      list = all.filter(r => !r.processedAt);
    } else if (status === 'processed') {
      list = all.filter(r => !!r.processedAt);
    } // 'all' => no filtering

    // newest first, by requestedAt (fallback to processedAt if needed)
    list.sort((a, b) => {
      const aTs = new Date((a as any).requestedAt ?? (a as any).processedAt ?? 0).getTime();
      const bTs = new Date((b as any).requestedAt ?? (b as any).processedAt ?? 0).getTime();
      return bTs - aTs;
    });

    res.json(limit ? list.slice(0, limit) : list);
  } catch (e) {
    console.error('Error fetching requests:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
app.delete('/api/requests/:id', authenticateJWT, async (req, res) => {
  const ok = await requests.deleteRequest(req.params.id);
  if (ok) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Request not found' });
  }
});

// --- Blocked IPs admin (protected) ---
app.get('/api/admin/blocked-ips', authenticateJWT, (req, res) => {
  res.json({ ok: true, items: blockedIPs.list() });
});
app.post('/api/admin/blocked-ips', authenticateJWT, (req, res) => {
  const { ip, reason } = req.body || {};
  if (!ip) { res.status(400).json({ ok: false, message: 'IP is required' }); return; }
  blockedIPs.add(String(ip).trim(), String(reason||'').trim(), 'admin');
  res.json({ ok: true });
});
app.delete('/api/admin/blocked-ips/:ip', authenticateJWT, (req, res) => {
  blockedIPs.remove(decodeURIComponent(req.params.ip));
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
