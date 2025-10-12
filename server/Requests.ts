import { v4 as uuidv4 } from 'uuid';
import { RequestDto } from '../shared/RequestDto';

type Status = 'pending' | 'held' | 'processed';
type InternalRequest = RequestDto & { status: Status };

export class Requests {
  private requests: InternalRequest[] = [];

  constructor() {}

  // Add a request; ensures IP and timestamp are captured
  async addRequest(trackGuid: string, requestedBy: string, message?: string, ipAddress?: string) {
    const now = new Date();
    this.requests.push({
      id: uuidv4(),
      trackGuid,
      requestedBy,
      message,
      ipAddress,
      requestedAt: now,
      status: 'pending',
    } as InternalRequest);
  }

  getAll() {
    return {
      pending: this.requests.filter(r => r.status === 'pending').sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)),
      held: this.requests.filter(r => r.status === 'held').sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)),
      processed: this.requests.filter(r => r.status === 'processed').sort((a,b)=>+new Date(b.processedAt || 0)-+new Date(a.processedAt || 0)),
    };
  }

  getNextPending(): InternalRequest | undefined {
    return this.requests.filter(r => r.status === 'pending').sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt))[0];
  }

  markProcessed(id: string): boolean {
    const r = this.requests.find(r => r.id === id);
    if (!r) return false;
    r.status = 'processed';
    r.processedAt = new Date();
    return true;
  }

  holdRequest(id: string): boolean {
    const r = this.requests.find(r => r.id === id);
    if (!r) return false;
    if (r.status === 'processed') return false;
    r.status = 'held';
    return true;
  }

  unholdRequest(id: string): boolean {
    const r = this.requests.find(r => r.id === id);
    if (!r) return false;
    if (r.status !== 'held') return false;
    r.status = 'pending';
    return true;
  }

  deleteRequest(id: string): boolean {
    const idx = this.requests.findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.requests.splice(idx, 1);
    return true;
  }
}
