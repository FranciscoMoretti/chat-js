import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { UiToolName } from "@/lib/ai/types";
// oxlint-disable-next-line import/no-nodejs-modules -- Node crypto supplies the server-side SHA-256 content hash.
import { createHash } from "node:crypto";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Callers import the named eveCreationContentHash binding. */
export const eveCreationContentHash = (
  message: ReadonlyEveMessageInput,
  selectedTool?: UiToolName
): string | undefined => {
  // Preserve the identity of already-reserved requests with automatic tools.
  if (!selectedTool && typeof message === "string") {
    // oxlint-disable-next-line no-undefined -- A plain string with automatic tools has no content hash; callers use the optional result.
    return undefined;
  }
  return createHash("sha256")
    .update(
      JSON.stringify(
        /* oxlint-disable no-ternary -- Keep JSON.stringify argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ selectedTool /* oxlint-enable no-ternary */
          ? { message, selectedTool }
          : message
      )
    )
    .digest("hex");
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
