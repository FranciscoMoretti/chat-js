import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { attachmentDigest, draftAttachment } from "@/lib/eve/draft";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (uploadAttachment); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve uploadAttachment's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const uploadAttachment = async (
  file: File
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
    ...uploaded,
    contentType: file.type,
    digest: await attachmentDigest(await file.arrayBuffer()),
    name: file.name,
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
