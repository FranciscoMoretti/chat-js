import { attachmentDigest, draftAttachment } from "@/lib/eve/draft";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const uploadAttachment = async (file: File) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
