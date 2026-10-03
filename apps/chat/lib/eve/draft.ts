/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { eveMessageInput } from "./message-input";
import type { EveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): draftAttachment stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named draftAttachment API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const draftAttachment = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  digest: z.string(),
  name: z.string(),
  url: z.string(),
});
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named DraftAttachment API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type DraftAttachment = z.infer<typeof draftAttachment>;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): restoreDraft stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named restoreDraft API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): restoreDraft accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const restoreDraft = (
  message: EveMessageInput
): {
  text: string;
  attachments: DraftAttachment[];
} => {
  if (typeof message === "string") {
    return { attachments: [], text: message };
  }
  return {
    attachments: message
      .filter((part) => part.type === "file")
      .map((part) => ({
        contentType: part.mediaType,
        digest: "",
        name: part.filename,
        url: part.data,
      })),
    text: message
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
  };
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): draftMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named draftMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): draftMessage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): draftMessage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): draftMessage accepts attachments: DraftAttachment[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const draftMessage = (
  text: string,
  attachments: DraftAttachment[]
): EveMessageInput => {
  if (attachments.length === 0) {
    return eveMessageInput.parse(text);
  }
  return eveMessageInput.parse([
    ...(text.trim() ? [{ text, type: "text" }] : []),
    ...attachments.map((file) => ({
      data: file.url,
      filename: file.name,
      mediaType: file.contentType,
      type: "file",
    })),
  ]);
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): attachmentDigest stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named attachmentDigest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): attachmentDigest uses 16, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): attachmentDigest sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): attachmentDigest accepts bytes: ArrayBuffer; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const attachmentDigest = async (bytes: ArrayBuffer): Promise<string> =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
