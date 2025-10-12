import { RequestAgent } from "./RequestAgent";
import { Requests } from "./Requests";

export class RequestProcessor {
  private isRunning = false;

  constructor(private requests: Requests, private requestAgent: RequestAgent) {
    const g: any = global as any;
    if (g.__bwProcessorStarted) return;
    g.__bwProcessorStarted = true;

    setInterval(() => {
      this.processRequests().catch(err => console.error('Processor error:', err));
    }, 10000);

    this.processRequests().catch(() => {});
  }

  async processRequests() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const queue = await this.requests.getAutoProcessEligible();
      if (!queue.length) return;

      const availableItems = await this.requestAgent.getAvailableItems();
      if (!availableItems.length) return;

      for (const request of queue) {
        const claimed = await this.requests.setProcessing(request.id, true);
        if (!claimed) continue;

        let processed = false;

        for (const item of [...availableItems]) {
          try {
            const ok = await this.requestAgent.requestTrack(
              request.trackGuid,
              item.breakNoteItemGuid,
              item.requestItemGuid,
              request.requestedBy + (request.message ? ` — ${request.message}` : '')
            );
            if (ok) {
              await this.requests.markProcessed(request.id);
              const idx = availableItems.indexOf(item);
              if (idx >= 0) availableItems.splice(idx, 1);
              processed = true;
              console.log('Processed request:', request.id);
              break;
            }
          } catch (e) {
            console.error('Failed processing request', request.id, e);
          }
        }

        if (!processed) {
          await this.requests.setProcessing(request.id, false);
          break;
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
