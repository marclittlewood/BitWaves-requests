export type RequestStatus = 'pending' | 'held' | 'processed' | 'processing';

export interface RequestItem {
  id: string;
  trackGuid: string;
  requestedBy?: string;
  message?: string;
  ipAddress?: string;
  requestedAt: string | Date;
  processedAt?: string | Date;
  status?: RequestStatus;
  heldAt?: number;
  force?: boolean;       // admin pressed Process -> prioritize
}

export class Requests {
  private items: RequestItem[] = [];

  constructor(
    private autoProcessMs: number = 5 * 60 * 1000,
    private holdMaxMs: number = 6 * 60 * 60 * 1000
  ) {}

  addRequest(trackGuid: string, requestedBy?: string, message?: string, ipAddress?: string): RequestItem {
    const item: RequestItem = {
      id: crypto.randomUUID(),
      trackGuid,
      requestedBy,
      message,
      ipAddress,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.items.push(item);
    return item;
  }

  getAll() {
    // group the way the client can consume
    return {
      pending: this.items.filter(r => !r.processedAt && r.status !== 'held'),
      held: this.items.filter(r => r.status === 'held'),
      processed: this.items.filter(r => !!r.processedAt),
    };
  }

  holdRequest(id: string) {
    const r = this.items.find(x => x.id === id && !x.processedAt);
    if (!r) return false;
    r.status = 'held';
    r.heldAt = Date.now();
    return true;
  }

  unholdRequest(id: string) {
    const r = this.items.find(x => x.id === id && x.status === 'held');
    if (!r) return false;
    r.status = 'pending';
    r.heldAt = undefined;
    return true;
  }

  /** Admin wants this to go now (next poll tick) */
  forceProcessNow(id: string) {
    const r = this.items.find(x => x.id === id && !x.processedAt);
    if (!r) return false;
    r.status = 'pending';   // if held, release it
    r.force = true;
    return true;
  }

  /** Called by RequestProcessor tick to take one ready item */
  takeNextForProcessing(now = Date.now()): RequestItem | undefined {
    // 1) force items first
    let idx = this.items.findIndex(r => !r.processedAt && r.status !== 'processing' && r.force === true);
    if (idx === -1) {
      // 2) pending items that aged >= autoProcessMs
      idx = this.items.findIndex(r => !r.processedAt
        && (r.status === 'pending' || !r.status)
        && (now - new Date(r.requestedAt).getTime() >= this.autoProcessMs));
    }
    if (idx === -1) {
      // 3) held items that reached holdMaxMs
      idx = this.items.findIndex(r => !r.processedAt
        && r.status === 'held'
        && typeof r.heldAt === 'number'
        && (now - r.heldAt >= this.holdMaxMs));
    }
    if (idx === -1) return undefined;
    const r = this.items[idx];
    r.status = 'processing';
    r.force = false;
    return r;
  }

  markProcessed(id: string) {
    const r = this.items.find(x => x.id === id);
    if (!r) return false;
    r.processedAt = new Date().toISOString();
    r.status = 'processed';
    r.heldAt = undefined;
    r.force = false;
    return true;
  }

  /** If a processing attempt fails, put it back to pending */
  requeue(id: string) {
    const r = this.items.find(x => x.id === id);
    if (!r) return false;
    if (!r.processedAt) r.status = 'pending';
    return true;
  }

  deleteRequest(id: string) {
    const i = self.items.findIndex(x => x.id == id);
    if (i === -1) return false;
    self.items.splice(i, 1);
    return true;
  }
}
// Node 18+ global crypto
declare const crypto: { randomUUID: () => string };
