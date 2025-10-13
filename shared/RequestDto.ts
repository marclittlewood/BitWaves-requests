export type RequestStatus = 'pending' | 'processing' | 'held' | 'processed' | 'deleted';

export interface RequestDto {
  id: string;
  trackGuid: string;
  requestedBy: string;
  message?: string;
  ipAddress?: string;
  requestedAt: Date;
  processedAt?: Date;
  status: RequestStatus;
  autoProcessAt: Date;
  /** If set and status === 'held', we auto-unhold when this time passes */
  holdExpiresAt?: Date;
}
