import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { reserveEveUpload, writeEveUpload } from "@/lib/db/eve-files";
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";

// Allow multipart headers and fields without buffering an unbounded request.
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const requestTooLarge = () =>
  NextResponse.json(
    { error: "Upload request exceeds the size limit" },
    { status: 413 }
  );

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= config.attachments.maxBytes, {
      message: "File exceeds the upload size limit",
    })
    .refine(
      (file) => Object.hasOwn(config.attachments.acceptedTypes, file.type),
      {
        message: "Unsupported file type",
      }
    ),
});

export const POST = async (request: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxRequestBytes =
    config.attachments.maxBytes + MAX_MULTIPART_OVERHEAD_BYTES;
  if (Number(request.headers.get("content-length")) > maxRequestBytes) {
    return requestTooLarge();
  }

  let receivedBytes = 0;
  let exceedsLimit = false;
  const body = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength;
        if (receivedBytes > maxRequestBytes) {
          exceedsLimit = true;
          controller.error(new Error("Upload request exceeds the size limit"));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
  const formData = await new Response(body, { headers: request.headers })
    .formData()
    .catch(() => null);
  if (exceedsLimit) {
    return requestTooLarge();
  }
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload form" }, { status: 400 });
  }

  try {
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = file.name;
    const fileBuffer = await file.arrayBuffer();

    try {
      const key = createFileId();
      await reserveEveUpload(session.user.id, key);
      // Keep the reservation if storage fails: an uncertain write can still finish.
      const write = () => uploadFileAtKey(key, filename, fileBuffer, file.type);
      const data = await writeEveUpload(session.user.id, key, write);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
};
