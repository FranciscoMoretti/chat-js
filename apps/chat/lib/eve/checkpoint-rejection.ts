import { z } from "zod";

export const checkpointRejectionReason = z.enum([
  "source_not_idle",
  "source_advanced",
]);

/** Only durable native rejections that prove this checkpoint never became usable. */
export class CheckpointRejected extends Error {
  readonly reason: z.infer<typeof checkpointRejectionReason>;

  constructor(reason: z.infer<typeof checkpointRejectionReason>) {
    super(
      reason === "source_not_idle"
        ? "The conversation was still running when the comparison was requested. Your draft is saved. Wait for it to finish, then send again."
        : "The conversation changed before the comparison could start. Your draft is saved. Review the latest response, then send again."
    );
    this.reason = reason;
  }
}
