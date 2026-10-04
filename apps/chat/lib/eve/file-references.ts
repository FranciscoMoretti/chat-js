/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 */
import { keyFromFileUrl } from "../file-url";
import type { EveMessageInput } from "./message-input";
/* oxlint-enable import/no-relative-parent-imports */

export const eveMessageFileKeys = (
  message:
    | string
    | readonly Readonly<Exclude<EveMessageInput, string>[number]>[]
): string[] => {
  if (typeof message === "string") {
    return [];
  }
  return message.flatMap((part) => {
    if (part.type === "text") {
      return [];
    }
    const key = keyFromFileUrl(part.data);
    if (key === null || key === "") {
      throw new Error("Invalid attachment reference.");
    }
    return [key];
  });
};
