export type RequestStatus = 'pending' | 'held' | 'processed' | 'deleted';

export interface RequestDto {
  id: string;
  trackGuid: string;
  requestedBy: string;
  message?: string;
  ipAddress?: string;
  requestedAt: Date;
  processedAt?: Date;
  /**
   * Current status within the admin workflow.
   * - pending: waiting to be auto-processed (after the 5 minute delay) or manually processed
   * - held: do not auto-process until announcer forces Process
   * - processed: pushed to PlayIt
   * - deleted: removed by announcer
   */
  status: RequestStatus;
  /**
   * Time when this request becomes eligible for auto-processing.
   * Default = requestedAt + 5 minutes (300000ms).
   */
  autoProcessAt: Date;
}
