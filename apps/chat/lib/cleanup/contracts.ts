/** Each task reports a bounded sweep. Pending work and skipped sweeps are never success. */
export interface CleanupResult {
  readonly deletedCount: number;
  readonly pendingCount?: number;
  readonly skipped: boolean;
}
export interface CleanupTask {
  readonly id: string;
  readonly run: () => Promise<CleanupResult>;
}
