import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { cleanupGuestRuntimeSessions } from "@/lib/eve/cleanup-guest-runtime";
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";

const NO_PENDING_GUESTS = 0;

// Four hours.
const ORPHANED_ATTACHMENTS_RETENTION_TIME = 14_400_000;
const cleanupResult = (
  attachments: ReadonlyNativeSurface<
    PromiseSettledResult<Awaited<ReturnType<typeof cleanupEveOrphanedFiles>>>
  >,
  guests: ReadonlyNativeSurface<
    PromiseSettledResult<Awaited<ReturnType<typeof cleanupExpiredEveGuests>>>
  >,
  runtimeGuests: PromiseSettledResult<
    Awaited<ReturnType<typeof cleanupGuestRuntimeSessions>>
  >
) => {
  const success =
    attachments.status === "fulfilled" &&
    !attachments.value.skipped &&
    guests.status === "fulfilled" &&
    !guests.value.skipped &&
    guests.value.pendingCount === NO_PENDING_GUESTS &&
    runtimeGuests.status === "fulfilled" &&
    !runtimeGuests.value.skipped &&
    runtimeGuests.value.pendingCount === NO_PENDING_GUESTS;
  return {
    results: {
      runtimeGuests:
        runtimeGuests.status === "fulfilled"
          ? runtimeGuests.value
          : { error: "Guest runtime cleanup failed; retry required." },
      expiredGuests:
        guests.status === "fulfilled"
          ? guests.value
          : { error: "Guest cleanup failed; retry required." },
      orphanedAttachments:
        attachments.status === "fulfilled"
          ? attachments.value
          : { error: "Attachment cleanup failed; retry required." },
    },
    success,
    timestamp: new Date().toISOString(),
  };
};

/** Run the shared cleanup tasks independently; failed work remains retryable.
 * @returns {Promise<ReturnType<typeof cleanupResult>>} Per-task counts or safe errors.
 */
export const runCleanupJob = async (): Promise<
  ReturnType<typeof cleanupResult>
> => {
  const cutoff = new Date(Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME);
  const [attachments, guests, runtimeGuests] = await Promise.allSettled([
    cleanupEveOrphanedFiles(cutoff),
    cleanupExpiredEveGuests(process.cwd()),
    cleanupGuestRuntimeSessions(),
  ]);
  return cleanupResult(attachments, guests, runtimeGuests);
};
