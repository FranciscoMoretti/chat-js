import { z } from "zod";

const checkpointRejectionReason = z.enum([
  "source_not_idle",
  "source_advanced",
]);

/** Only durable native rejections that prove this checkpoint never became usable. */
class CheckpointRejectedError extends Error {
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
export { CheckpointRejectedError, checkpointRejectionReason };
