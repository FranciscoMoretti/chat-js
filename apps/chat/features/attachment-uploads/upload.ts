import { attachmentDigest, draftAttachment } from "@/lib/eve/draft";

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
