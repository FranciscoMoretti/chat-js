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
      // oxlint-disable-next-line no-ternary -- Keep super argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      reason === "source_not_idle"
        ? "The conversation was still running when the comparison was requested. Your draft is saved. Wait for it to finish, then send again."
        : "The conversation changed before the comparison could start. Your draft is saved. Review the latest response, then send again."
    );
    this.name = "CheckpointRejectedError";
    this.reason = reason;
  }
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CheckpointRejectedError, checkpointRejectionReason); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { CheckpointRejectedError, checkpointRejectionReason };
/* oxlint-enable import/no-named-export */
