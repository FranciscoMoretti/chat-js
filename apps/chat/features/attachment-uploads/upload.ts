import { attachmentDigest, draftAttachment } from "@/lib/eve/draft";
import type { z } from "zod";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (uploadAttachment); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve uploadAttachment's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
export const uploadAttachment = async (
  file: Readonly<File>
): Promise<z.infer<typeof draftAttachment>> => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/files/upload", {
    body,
    method: "POST",
  });
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);
    throw new Error(
      // oxlint-disable-next-line no-ternary -- Keep Error argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      failure !== null &&
        typeof failure === "object" &&
        "error" in failure &&
        typeof failure.error === "string"
        ? failure.error
        : `Unable to upload ${file.name}.`
    );
  }
  const uploaded: unknown = await response.json();
  if (uploaded === null || typeof uploaded !== "object") {
    throw new Error(`Invalid upload response for ${file.name}.`);
  }
  return draftAttachment.parse({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing uploaded own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...uploaded,
    contentType: file.type,
    digest: await attachmentDigest(await file.arrayBuffer()),
    name: file.name,
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
