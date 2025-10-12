import { v4 as uuidv4 } from 'uuid';
import { RequestDto, RequestStatus } from '../shared/RequestDto';

const AUTO_PROCESS_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export class Requests {
  private requests: RequestDto[] = [];

  async init() {
    // No-op; placeholder for persistence hydration if needed.
    return;
  }

  async addRequest(trackGuid: string, requestedBy: string, message?: string, ipAddress?: string) {
    const now = new Date();
    const req: RequestDto = {
      id: uuidv4(),
      trackGuid,
      requestedBy,
      message,
      ipAddress,
      requestedAt: now,
      status: 'pending',
      autoProcessAt: new Date(now.getTime() + AUTO_PROCESS_DELAY_MS)
    };
    this.requests.push(req);
    return req;
  }

  async getRequests(status: 'all' | RequestStatus = 'all', limit: number = 200) {
    let list = this.requests.slice();
    if (status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    return list.sort((a,b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)).slice(0, limit);
  }

  async deleteRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'deleted';
    return true;
  }

  async holdRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'held';
    return true;
  }

  async unholdRequest(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    const now = new Date();
    req.status = 'pending';
    req.autoProcessAt = new Date(now.getTime() + AUTO_PROCESS_DELAY_MS);
    return true;
  }

  async forceProcessNow(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'pending';
    req.autoProcessAt = new Date(Date.now() - 1000); // eligible immediately
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
    return true;
  }

  async markProcessed(id: string) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return false;
    req.status = 'processed';
    req.processedAt = new Date();
    // make it permanently ineligible unless manually changed
    req.autoProcessAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    return true;
  }

  async getAutoProcessEligible(): Promise<RequestDto[]> {
    const now = Date.now();
    return this.requests.filter(r => r.status === 'pending' && new Date(r.autoProcessAt).getTime() <= now);
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

  // --- Per-track cooldown helpers ---
  getLastActivityForTrack(trackGuid: string): Date | null {
    const candidates = this.requests
      .filter(r => r.trackGuid === trackGuid && r.status !== 'deleted')
      .map(r => {
        const ra = new Date(r.requestedAt).getTime();
        const pa = r.processedAt ? new Date(r.processedAt).getTime() : 0;
        return Math.max(ra, pa);
      });
    if (!candidates.length) return null;
    return new Date(Math.max(...candidates));
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
