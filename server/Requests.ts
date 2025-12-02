import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RequestDto, RequestStatus } from '../shared/RequestDto';

const AUTO_PROCESS_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const HOLD_EXPIRE_MS = 6 * 60 * 60 * 1000; // 6 hours

export class Requests {
  private requests: RequestDto[] = [];
  private filePath: string;

  constructor() {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'requests.json');
  }

  async init() {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as RequestDto[];
      this.requests = parsed.map(r => ({
        ...r,
        requestedAt: new Date(r.requestedAt),
        processedAt: r.processedAt ? new Date(r.processedAt) : undefined,
        autoProcessAt: r.autoProcessAt ? new Date(r.autoProcessAt) : new Date(),
        holdExpiresAt: r.holdExpiresAt ? new Date(r.holdExpiresAt) : undefined,
      }));
      console.log(`Loaded ${this.requests.length} saved requests from ${this.filePath}`);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        // first run, no file yet
        this.requests = [];
      } else {
        console.error('Failed to load requests.json', err);
        this.requests = [];
      }
    }
  }

  private async save() {
    try {
      const serialisable = this.requests.map(r => ({
        ...r,
        requestedAt: new Date(r.requestedAt).toISOString(),
        processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : undefined,
        autoProcessAt: new Date(r.autoProcessAt).toISOString(),
        holdExpiresAt: r.holdExpiresAt ? new Date(r.holdExpiresAt).toISOString() : undefined,
      }));
      await fs.promises.writeFile(this.filePath, JSON.stringify(serialisable, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save requests.json', err);
    }
  }

  async addRequest(trackGuid: string, requestedBy: string, message?: string, ipAddress?: string, trackArtistTitle?: string) {
    const now = new Date();
    const req: RequestDto = {
      id: uuidv4(),
      trackGuid,
      requestedBy,
      trackArtistTitle,
      message,
      ipAddress,
      requestedAt: now,
      status: 'pending',
      autoProcessAt: new Date(now.getTime() + AUTO_PROCESS_DELAY_MS)
    };
    this.requests.push(req);
    await this.save();
    return req;
  }

  async getRequests(status: 'all' | RequestStatus = 'all', limit: number = 200): Promise<RequestDto[]> {
    let list = this.requests.slice();
    if (status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    list = list.sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt));
    return list.slice(0, limit);
  }

  async deleteRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'deleted';
    req.processedAt = new Date();
    // prevent any further auto-processing on deleted
    req.autoProcessAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await this.save();
    return true;
  }

  async holdRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'held';
    req.holdExpiresAt = new Date(Date.now() + HOLD_EXPIRE_MS);
    await this.save();
    return true;
  }

  async unholdRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    const now = new Date();
    req.holdExpiresAt = undefined;
    req.status = 'pending';
    req.autoProcessAt = new Date(now.getTime() + AUTO_PROCESS_DELAY_MS);
    await this.save();
    return true;
  }

  async forceProcessNow(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'pending';
    req.autoProcessAt = new Date(Date.now() - 1000); // eligible immediately
    await this.save();
    return true;
  }

  async setProcessing(id: string, isProcessing: boolean) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    if (isProcessing) {
      if (req.status !== 'pending') return false;
      req.status = 'processing';
    } else {
      if (req.status === 'processing') req.status = 'pending';
    }
    await this.save();
    return true;
  }

  async markProcessed(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'processed';
    req.processedAt = new Date();
    // make it permanently ineligible unless manually changed
    req.autoProcessAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await this.save();
    return true;
  }

  async getRequestsByStatus(status: RequestStatus): Promise<RequestDto[]> {
    return this.requests.filter(r => r.status === status);
  }

  async getAutoProcessEligible(): Promise<RequestDto[]> {
    const now = Date.now();
    return this.requests.filter(r =>
      r.status === 'pending' &&
      new Date(r.autoProcessAt).getTime() <= now
    );
  }

  // --- Moderation helpers ---
  private countInWindowByIp(ipAddress: string, windowMs: number): number {
    const now = Date.now();
    return this.requests.filter(r => {
      if (!r.ipAddress) return false;
      const ts = new Date(r.requestedAt).getTime();
      return r.ipAddress === ipAddress && (now - ts) <= windowMs;
    }).length;
  }

  async getCountsByIp(ipAddress: string) {
    const perHour = this.countInWindowByIp(ipAddress, 60 * 60 * 1000);
    const perDay  = this.countInWindowByIp(ipAddress, 24 * 60 * 60 * 1000);
    return { perHour, perDay };
  }

  /**
   * Get the timestamp of the last activity (request or process) for the given track.
   * Used to enforce a cooldown window where the same track can't be requested again.
   */
  private getLastActivityForTrack(trackGuid: string): Date | null {
    const candidates = this.requests
      .filter(r => r.trackGuid === trackGuid)
      .map(r => {
        const ra = new Date(r.requestedAt).getTime();
        const pa = r.processedAt ? new Date(r.processedAt).getTime() : 0;
        return Math.max(ra, pa);
      });
    if (!candidates.length) return null;
    return new Date(Math.max(...candidates));
  }

  /**
   * Auto-release held requests whose hold has expired.
   * Sets status back to 'pending' and makes them immediately eligible.
   */
  async releaseExpiredHolds() {
    const now = Date.now();
    let changed = false;
    for (const r of this.requests) {
      if (r.status === 'held' && r.holdExpiresAt) {
        const exp = new Date(r.holdExpiresAt).getTime();
        if (exp <= now) {
          r.status = 'pending';
          r.autoProcessAt = new Date(Date.now() - 1000);
          r.holdExpiresAt = undefined;
          changed = true;
        }
      }
    }
    if (changed) {
      await this.save();
    }
  }

  isWithinCooldown(trackGuid: string, cooldownMs: number): { blocked: boolean, nextAllowedAt?: Date } {
    const last = this.getLastActivityForTrack(trackGuid);
    if (!last) return { blocked: false };
    const nextAllowed = new Date(last.getTime() + cooldownMs);
    if (Date.now() < nextAllowed.getTime()) {
      return { blocked: true, nextAllowedAt: nextAllowed };
    }
    return { blocked: false };
  }
}
