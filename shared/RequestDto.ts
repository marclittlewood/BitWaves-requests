export type RequestStatus = 'pending' | 'processing' | 'held' | 'processed' | 'deleted';

export interface RequestDto {
  id: string;
  trackGuid: string;
  requestedBy: string;
  /** snapshot of the display title at request time */
  trackArtistTitle?: string;
  message?: string;
  ipAddress?: string;
  requestedAt: Date;
  processedAt?: Date;
  status: RequestStatus;
  autoProcessAt: Date;
  /** If set and status === 'held', we auto-unhold when this time passes */
  holdExpiresAt?: Date;

  /**
   * PlayIt playout item assigned to this request.  The item GUID stays the same
   * when the scheduled song is replaced, which lets the public queue follow
   * PlayIt's live expected start time as the log moves.
   */
  assignedPlayoutItemGuid?: string;
  /** Last known expected start time for the requested song. */
  expectedPlayTime?: Date;
}
