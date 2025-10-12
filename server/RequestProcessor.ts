import { RequestAgent } from "./RequestAgent";
import { Requests } from "./Requests";

export class RequestProcessor {
  private timer: any;

  constructor(private requests: Requests, private requestAgent: RequestAgent) {
    this.timer = setInterval(() => this.processRequests().catch(()=>{}), 10000);
    this.processRequests().catch(()=>{});
  }

  async processRequests() {
    // Try to process as many pending requests as we have available slots
    let availableItems = await this.requestAgent.getAvailableItems();
    while (availableItems.length > 0) {
      const next = this.requests.getNextPending();
      if (!next) break;

      // Who requested?
      const requestText = next.requestedBy || 'Anonymous';

      // Grab the first available slot
      const item = availableItems.shift();
      if (!item) break;

      // Send to PlayIt Live
      await this.requestAgent.requestTrack(next.trackGuid, item.breakNoteItemGuid, item.requestItemGuid, requestText);

      // Mark processed
      this.requests.markProcessed(next.id);
      console.log('Processed request:', next);
    }
  }
}
