/** Each task reports a bounded sweep. Pending work and skipped sweeps are never success. */
export interface CleanupResult {
  readonly deletedCount: number;
  /** Sessions ended with payloads still governed by provider retention. */
  readonly retiredCount?: number;
  readonly pendingCount?: number;
  readonly skipped: boolean;
}
export interface CleanupTask {
  readonly id: string;
  /** Best-effort deadline for new work; does not promise cancellation of database/storage calls. */
  readonly run: (options?: {
    readonly deadline?: number;
  }) => Promise<CleanupResult>;
}
