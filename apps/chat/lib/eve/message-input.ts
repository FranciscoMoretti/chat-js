/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

import { keyFromFileUrl } from "../file-url";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): textPart uses 1, 16_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const textPart = z
  .object({
    type: z.literal("text"),
    text: z.string().trim().min(1).max(16_000),
  })
  .strict();
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): filePart uses 1, 255 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const filePart = z
  .object({
    type: z.literal("file"),
    data: z
      .string()
      .refine(
        (value) =>
          value.startsWith("/api/files/") && keyFromFileUrl(value) !== null,
        "Use a ChatJS upload"
      ),
    mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    filename: z.string().min(1).max(255),
  })
  .strict();
/* oxlint-enable no-magic-numbers */
/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveMessageInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveMessageInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveMessageInput uses 1, 16_000, 17, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveMessageInput accepts parts; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveMessageInput = z.union([
  z.string().trim().min(1).max(16_000),
  z
    .array(z.union([textPart, filePart]))
    .min(1)
    .max(17)
    .refine(
      (parts) =>
        parts.filter((part) => part.type === "text").length <= 1 &&
        parts.filter((part) => part.type === "file").length <= 16
    ),
]);
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */
export type EveMessageInput = z.infer<typeof eveMessageInput>;
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveMessageTitle stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveMessageTitle API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveMessageTitle accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveMessageTitle = (message: EveMessageInput): string => {
  if (typeof message === "string") {
    return message;
  }
  const text = message.find((part) => part.type === "text");
  if (text) {
    return text.text;
  }
  return message
    .filter((part) => part.type === "file")
    .map((part) => part.filename)
    .join(", ");
};
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */
