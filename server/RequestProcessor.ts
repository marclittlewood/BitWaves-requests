import { Requests, RequestItem } from './Requests';

type Agent = {
  getAvailableItems(): number;
  requestTrack(trackGuid: string, breakNoteItemGuid?: string | null, requestItemGuid?: string | null, requestedBy?: string | null): Promise<void>;
};

export class RequestProcessor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly agent: Agent,
    private readonly requests: Requests,
    private readonly pollMs: number = 10_000 // 10s
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.tick().catch(()=>{}); }, this.pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    let slots = this.agent.getAvailableItems();
    if (slots <= 0) return;

    while (slots-- > 0) {
      const next = this.requests.takeNextForProcessing(Date.now());
      if (!next) break;
      try {
        await this.agent.requestTrack(next.trackGuid, undefined, undefined, next.requestedBy ?? null);
        this.requests.markProcessed(next.id);
      } catch (err) {
        this.requests.requeue(next.id);
      }
    }
  }
}
