import { v4 as uuidv4 } from 'uuid';
import { RequestDto } from '../shared/RequestDto';

export class Requests {
    private requests: RequestDto[];

    constructor() {
        this.requests = [];
    }

    // Add a request; ensures IP and timestamp are captured
    async addRequest(trackGuid: string, requestedBy: string, message?: string, ipAddress?: string) {
        this.requests.push({
            id: uuidv4(),
            trackGuid,
            requestedBy,
            message,
            ipAddress,
            requestedAt: new Date(),
            processedAt: undefined
        });
    }

    async init() {
        this.requests = [];
    }

    async getRequests() {
        return this.requests;
    }

    async getUnprocessedRequests() {
        return this.requests.filter(r => !r.processedAt);
    }

    async isTrackAlreadyRequested(trackGuid: string) {
        return this.requests.some(r => r.trackGuid === trackGuid && !r.processedAt);
    }

    async markProcessed(id: string) {
        const request = this.requests.find(r => r.id === id);
        if (request) {
            request.processedAt = new Date();
        }
    }

    async deleteRequest(id: string) {
        const requestIndex = this.requests.findIndex(r => r.id === id);
        if (requestIndex !== -1) {
            this.requests.splice(requestIndex, 1);
            return true;
        }
        return false;
    }

    // Rolling-window counter by IP (ms window)
    private countInWindowByIp(ipAddress: string, windowMs: number): number {
        const now = Date.now();
        return this.requests.filter(r => {
            if (!r.ipAddress) return false;
            const ts = new Date(r.requestedAt).getTime();
            return r.ipAddress === ipAddress && (now - ts) <= windowMs;
        }).length;
    }

    // Public helper to fetch counts for current hour/day (rolling windows)
    async getCountsByIp(ipAddress: string) {
        const perHour = this.countInWindowByIp(ipAddress, 60 * 60 * 1000);
        const perDay  = this.countInWindowByIp(ipAddress, 24 * 60 * 60 * 1000);
        return { perHour, perDay };
    }
}
