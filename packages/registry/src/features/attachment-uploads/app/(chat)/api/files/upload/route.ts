import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { reserveEveUpload, writeEveUpload } from "@/lib/db/eve-files";
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";

// Allow multipart headers and fields without buffering an unbounded request.
const MAX_MULTIPART_OVERHEAD_BYTES = 65_536;
const requestTooLarge = (): NextResponse<{ error: string }> =>
  NextResponse.json(
    { error: "Upload request exceeds the size limit" },
    { status: 413 }
  );

// Validate uploaded bytes through the Blob interface; File extends Blob.
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine(
      (file: Readonly<Pick<Blob, "size">>): boolean =>
        file.size <= config.attachments.maxBytes,
      {
        message: "File exceeds the upload size limit",
      }
    )
    .refine(
      (file: Readonly<Pick<Blob, "type">>): boolean =>
        Object.hasOwn(config.attachments.acceptedTypes, file.type),
      {
        message: "Unsupported file type",
      }
    ),
});
// Keep stream accounting synchronous; the getter observes the counter after parsing.
const limitUploadBody = (
  request: ReadonlyNativeSurface<Pick<Request, "body">>,
  maxRequestBytes: number
): {
  readonly body: ReadableStream<Uint8Array> | undefined;
  readonly exceeded: boolean;
} => {
  let receivedBytes = 0;
  let exceedsLimit = false;
  const body = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(
        chunk: ReadonlyNativeSurface<Uint8Array>,
        controller: Readonly<
          Pick<
            TransformStreamDefaultController<Uint8Array>,
            "error" | "enqueue"
          >
        >
      ): void {
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
  return {
    body,
    get exceeded(): boolean {
      return exceedsLimit;
    },
  };
};

const validateUploadForm = (
  formData: ReadonlyNativeSurface<Pick<FormData, "get">>
):
  | { readonly file: File }
  | { readonly response: ReturnType<typeof requestTooLarge> } => {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return {
      response: NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      ),
    };
  }

  const validatedFile = FileSchema.safeParse({ file });

  if (!validatedFile.success) {
    const errorMessage = validatedFile.error.issues
      .map(
        (issue: Readonly<Pick<z.core.$ZodIssue, "message">>): string =>
          issue.message
      )
      .join(", ");

    return {
      response: NextResponse.json({ error: errorMessage }, { status: 400 }),
    };
  }

  return { file };
};

export const POST = async (
  request: ReadonlyNativeSurface<Request>
): Promise<
  | ReturnType<typeof requestTooLarge>
  | NextResponse<Awaited<ReturnType<typeof uploadFileAtKey>>>
> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxRequestBytes =
    config.attachments.maxBytes + MAX_MULTIPART_OVERHEAD_BYTES;
  if (Number(request.headers.get("content-length")) > maxRequestBytes) {
    return requestTooLarge();
  }

  const limitedBody = limitUploadBody(request, maxRequestBytes);
  const formData = await new Response(limitedBody.body, {
    headers: request.headers,
  })
    .formData()
    .catch(() => null);
  if (limitedBody.exceeded) {
    return requestTooLarge();
  }
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload form" }, { status: 400 });
  }

  try {
    const validated = validateUploadForm(formData);
    if ("response" in validated) {
      return validated.response;
    }
    const { file } = validated;

    // Get filename from formData since Blob doesn't have name property
    const filename = file.name;
    const fileBuffer = await file.arrayBuffer();

    try {
      const key = createFileId();
      await reserveEveUpload(session.user.id, key);
      // Keep the reservation if storage fails: an uncertain write can still finish.
      const write = async (): ReturnType<typeof uploadFileAtKey> =>
        await uploadFileAtKey(key, filename, fileBuffer, file.type);
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
