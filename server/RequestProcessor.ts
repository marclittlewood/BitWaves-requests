import { RequestAgent } from "./RequestAgent";
import { Requests } from "./Requests";

export class RequestProcessor {
  constructor(private requests: Requests, private requestAgent: RequestAgent) {
    // process requests every 10 seconds
    setInterval(() => {
      this.processRequests().catch(err => console.error('Processor error:', err));
    }, 10000);

    // Kick once on boot
    this.processRequests().catch(() => {});
  }

  async processRequests() {
    // Only pending + autoProcessAt <= now are eligible here
    const queue = await this.requests.getAutoProcessEligible();
    if (!queue.length) return;

    // Determine available playout slots
    const availableItems = await this.requestAgent.getAvailableItems();

    for (const request of queue) {
      let processed = false;
      for (const item of availableItems) {
        try {
          const ok = await this.requestAgent.requestTrack(
            request.trackGuid,
            item.breakNoteItemGuid,
            item.requestItemGuid,
            request.requestedBy + (request.message ? ` — ${request.message}` : '')
          );
          if (ok) {
            await this.requests.markProcessed(request.id);
            // consume one available slot per processed request
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
        // No available items right now; will retry on next tick
        break;
      }
    }
  }
}
