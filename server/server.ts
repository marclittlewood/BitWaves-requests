import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { Tracks } from './Tracks';
import { Requests } from './Requests';
import { PlayItLiveApiClient } from './PlayItLiveApiClient';
import { RequestProcessor } from './RequestProcessor';
import { RequestAgent } from './RequestAgent';
import { authenticateJWT, login } from './auth';
import { SettingsDto } from '../shared/SettingsDto';

if (process.env.NODE_ENV !== 'production') {
 dotenv.config();
}

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

const PORT = Number(process.env.PORT || 3000);
const MAX_REQUESTS_PER_HOUR = Number(process.env.MAX_REQUESTS_PER_HOUR || 4);
const MAX_REQUESTS_PER_DAY = Number(process.env.MAX_REQUESTS_PER_DAY || 20);
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
const requestSweeperTrackGroupName = process.env.REQUEST_SWEEPER_TRACK_GROUP_NAME;
const requestSweeperPlaceholderTrackName = process.env.REQUEST_SWEEPER_PLACEHOLDER_TRACK_NAME || 'Request Sweeper Placeholder';
const normalSweeperTrackGroupNames = (
 process.env.NORMAL_SWEEPER_TRACK_GROUP_NAMES ||
 process.env.NORMAL_IMAGING_TRACK_GROUP_NAMES ||
 ''
)
 .split(/[,;\n]/)
 .map(name => name.trim())
 .filter(Boolean);

const playItLiveApiClient = new PlayItLiveApiClient(playItLiveBaseUrl, playItLiveApiKey);
const tracks = new Tracks(
 playItLiveApiClient,
 requestableTrackGroupName,
 requestSweeperTrackGroupName,
 normalSweeperTrackGroupNames
);
tracks.init();

const requests = new Requests();
requests.init();

const requestAgent = new RequestAgent(playItLiveApiClient, tracks, requestSweeperPlaceholderTrackName);
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

// Public, privacy-safe request feed for the BitWaves website.
// Pending requests are shown in queue order. Once a request is assigned to a
// PlayIt playout item it remains visible as "scheduled" and, where possible,
// its expected start time is refreshed from PlayIt's live playout log.
// Listener names, messages, IP addresses and PlayIt item GUIDs are never exposed.
app.get('/api/public/queue', async (req: Request, res: Response) => {
 try {
  const requestedLimit = Number(req.query.limit || 12);
  const limit = Number.isFinite(requestedLimit)
   ? Math.max(1, Math.min(30, Math.floor(requestedLimit)))
   : 12;

  const all = await requests.getRequests('all', 500);
  const waiting = all
   .filter(r => r.status === 'pending' || r.status === 'processing')
   .sort((a, b) => +new Date(a.requestedAt) - +new Date(b.requestedAt));

  const assigned = all.filter(r => r.status === 'processed' && !!r.assignedPlayoutItemGuid);
  let liveSchedule = new Map<string, {
   guid: string;
   startTime?: string;
   displayStartTime?: string;
   hasPlayed: boolean;
   isInPast: boolean;
   willSkip: boolean;
   isSoftDeleted: boolean;
  }>();

  if (assigned.length) {
   try {
    liveSchedule = await requestAgent.getLiveScheduleForItems(
     assigned.map(r => r.assignedPlayoutItemGuid!).filter(Boolean)
    );
   } catch (error) {
    // The stored assignment time is intentionally retained as a fallback so a
    // brief PlayIt API outage does not make scheduled requests disappear.
    console.warn('Unable to refresh public request times from PlayIt:', error);
   }
  }

  const now = Date.now();
  const storedTimeGraceMs = 15 * 60 * 1000;
  const scheduled = assigned.flatMap(r => {
   const itemGuid = r.assignedPlayoutItemGuid!;
   const live = liveSchedule.get(itemGuid);

   if (live && (live.hasPlayed || live.willSkip || live.isSoftDeleted)) {
    return [];
   }

   const candidate = live?.startTime || (r.expectedPlayTime ? new Date(r.expectedPlayTime).toISOString() : '');
   const parsed = candidate ? new Date(candidate) : null;
   const expectedPlayTime = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

   // If PlayIt cannot currently resolve the item, keep a recently scheduled
   // request visible around its last known time, but expire old stale entries.
   if (!live && (!expectedPlayTime || expectedPlayTime.getTime() < now - storedTimeGraceMs)) {
    return [];
   }

   return [{
    request: r,
    expectedPlayTime,
    timingSource: (live ? 'live-log' : 'stored') as 'live-log' | 'stored',
   }];
  }).sort((a, b) => {
   const at = a.expectedPlayTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
   const bt = b.expectedPlayTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
   if (at !== bt) return at - bt;
   return +new Date(a.request.requestedAt) - +new Date(b.request.requestedAt);
  });

  const publicItems: Array<{
   id: string;
   trackArtistTitle: string;
   status: 'pending' | 'processing' | 'scheduled';
   requestedAt: string;
   expectedPlayTime?: string;
   timingSource?: 'live-log' | 'stored';
  }> = [];

  for (const row of scheduled) {
   const track = tracks.getTrackByGuid(row.request.trackGuid);
   publicItems.push({
    id: row.request.id,
    trackArtistTitle: row.request.trackArtistTitle || track?.artistTitle || 'Requested song',
    status: 'scheduled',
    requestedAt: new Date(row.request.requestedAt).toISOString(),
    expectedPlayTime: row.expectedPlayTime?.toISOString(),
    timingSource: row.timingSource,
   });
  }

  for (const r of waiting) {
   const track = tracks.getTrackByGuid(r.trackGuid);
   publicItems.push({
    id: r.id,
    trackArtistTitle: r.trackArtistTitle || track?.artistTitle || 'Requested song',
    status: r.status === 'processing' ? 'processing' : 'pending',
    requestedAt: new Date(r.requestedAt).toISOString(),
   });
  }

  const total = publicItems.length;
  const items = publicItems.slice(0, limit).map((item, index) => ({
   ...item,
   position: index + 1,
  }));

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({ success: true, total, items, serverNow: new Date().toISOString() });
 } catch (error) {
  console.error('Error fetching public request queue:', error);
  res.status(500).json({ success: false, message: 'Request queue unavailable' });
 }
});

app.post('/api/requestTrack', async (req: Request, res: Response) => {
 try {
  const { trackGuid, requestedBy, message } = req.body || {};

  // Per-track cooldown (default 6 hours; override with env REQUEST_TRACK_COOLDOWN_HOURS)
  try {
   const hours = Number(process.env.REQUEST_TRACK_COOLDOWN_HOURS || 6);
   const cooldownMs = hours * 60 * 60 * 1000;
   if (trackGuid) {
    const cd = requests.isWithinCooldown(trackGuid, cooldownMs);
    if (cd.blocked) {
     res.status(429).json({
      success: false,
      error: 'COOLDOWN_ACTIVE',
      cooldownHours: hours,
      nextAllowedAt: cd.nextAllowedAt,
     });
     return;
    }
   }
  } catch (e) {
   console.error('Cooldown check error', e);
  }

  const clientIp = getClientIp(req);
  const messageString = (message ?? '').toString();
  const trimmedMessage = messageString.slice(0, MAX_MESSAGE_LENGTH);

  if (!trackGuid || !requestedBy) {
   res.status(400).json({ success: false, message: 'Track GUID and requester name are required' });
   return;
  }

  const { perHour, perDay } = await requests.getCountsByIp(clientIp);
  if (perHour >= MAX_REQUESTS_PER_HOUR) {
   res.status(429).json({
    success: false,
    message: `Per-IP limit reached: max ${MAX_REQUESTS_PER_HOUR} requests per hour.`,
   });
   return;
  }

  if (perDay >= MAX_REQUESTS_PER_DAY) {
   res.status(429).json({
    success: false,
    message: `Per-IP limit reached: max ${MAX_REQUESTS_PER_DAY} requests per 24 hours.`,
   });
   return;
  }

  const foundTrack = tracks.getTrackByGuid(trackGuid);
  const trackArtistTitle = foundTrack?.artistTitle;
  const addedRequest = await requests.addRequest(
   trackGuid,
   requestedBy,
   trimmedMessage,
   clientIp,
   trackArtistTitle
  );

  // Returning the ID allows the BitWaves website to highlight this listener's
  // request in the public pending queue on that device.
  res.json({ success: true, requestId: addedRequest.id });
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

// --- Admin request workflow endpoints (Hold / Unhold / Process Now) ---
app.post('/api/requests/:id/hold', authenticateJWT, async (req: Request, res: Response) => {
 const ok = await requests.holdRequest(req.params.id);
 if (!ok) {
  res.status(404).json({ success: false, message: 'Request not found' });
  return;
 }
 res.json({ success: true });
});

app.post('/api/requests/:id/unhold', authenticateJWT, async (req: Request, res: Response) => {
 const ok = await requests.unholdRequest(req.params.id);
 if (!ok) {
  res.status(404).json({ success: false, message: 'Request not found' });
  return;
 }
 res.json({ success: true });
});

app.post('/api/requests/:id/process', authenticateJWT, async (req: Request, res: Response) => {
 try {
  const id = req.params.id;

  // Load first so we can handle 'held'
  const allBefore = await requests.getRequests('all');
  const existing = allBefore.find(r => r.id === id);
  if (!existing) {
   res.status(404).json({ success: false, message: 'Request not found' });
   return;
  }

  // If held, unhold so we can claim
  if (existing.status === 'held') {
   const unheld = await requests.unholdRequest(id);
   if (!unheld) {
    res.status(409).json({ success: false, message: 'Unable to unhold request' });
    return;
   }
  }

  // Claim for immediate processing
  const claimed = await requests.setProcessing(id, true);
  if (!claimed) {
   res.status(409).json({ success: false, message: 'Unable to claim request for processing' });
   return;
  }

  // Re-fetch for TS narrowing
  const all = await requests.getRequests('all');
  const found = all.find(r => r.id === id);
  if (!found) {
   await requests.setProcessing(id, false);
   res.status(404).json({ success: false, message: 'Request not found' });
   return;
  } else {
   const note = `${found.requestedBy ?? ''}${found.message ? ' - ' + found.message : ''}`;
   const pairs = await requestAgent.getAvailableItems();
   if (!pairs || pairs.length === 0) {
    await requests.setProcessing(id, false);
    res.status(409).json({ success: false, message: 'No available request slots in playout log.' });
    return;
   }

   let processed = false;
   for (const pair of pairs) {
    try {
     const ok = await requestAgent.requestTrack(
      found.trackGuid,
      pair,
      note
     );
     if (ok.success) {
      await requests.markProcessed(id, {
       requestItemGuid: ok.requestItemGuid,
       expectedPlayTime: ok.scheduledStartTime,
      });
      processed = true;
      break;
     }
    } catch {
     // try next slot
    }
   }

   if (!processed) {
    await requests.setProcessing(id, false);
    res.status(502).json({ success: false, message: 'Failed to process request via PlayIt Live.' });
    return;
   }

   res.json({ success: true });
  }
 } catch (err) {
  console.error('Immediate process error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
 }
});

app.get('*', (req, res) => {
 res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT, () => {
 console.log(`Server is running on port ${PORT}`);
});
