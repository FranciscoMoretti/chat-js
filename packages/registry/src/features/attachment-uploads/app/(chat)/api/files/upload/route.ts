import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { reserveEveUpload, writeEveUpload } from "@/lib/db/eve-files";
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";

// Validate uploaded bytes through the Blob interface; File extends Blob.
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

  const formData = await request.formData().catch(() => null);
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
