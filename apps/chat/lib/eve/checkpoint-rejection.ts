import { z } from "zod";

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): checkpointRejectionReason stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const checkpointRejectionReason = z.enum([
  "source_not_idle",
  "source_advanced",
]);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): CheckpointRejectedError stays exported at its declaration so its public contract is visible beside its implementation.
 */
/** Only durable native rejections that prove this checkpoint never became usable. */
export class CheckpointRejectedError extends Error {
  public readonly reason: z.infer<typeof checkpointRejectionReason>;

  public constructor(reason: z.infer<typeof checkpointRejectionReason>) {
    super(
      reason === "source_not_idle"
        ? "The conversation was still running when the comparison was requested. Your draft is saved. Wait for it to finish, then send again."
        : "The conversation changed before the comparison could start. Your draft is saved. Review the latest response, then send again."
    );
    this.name = "CheckpointRejectedError";
    this.reason = reason;
  }
}
/* oxlint-enable import/group-exports */
