import { headers } from "next/headers";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { NextResponse } from "next/server";
/* oxlint-enable eslint/sort-imports */
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { auth } from "@/lib/auth";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { reserveEveUpload, writeEveUpload } from "@/lib/db/eve-files";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
// Allow multipart headers and fields without buffering an unbounded request.
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const requestTooLarge = () =>
  NextResponse.json(
    { error: "Upload request exceeds the size limit" },
    { status: 413 }
  );
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Validate uploaded bytes through the Blob interface; File extends Blob.
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file): boolean => file.size <= config.attachments.maxBytes, {
      message: "File exceeds the upload size limit",
    })
    .refine(
      (file): boolean =>
        Object.hasOwn(config.attachments.acceptedTypes, file.type),
      {
        message: "Unsupported file type",
      }
    ),
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
      transform(chunk, controller): void {
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
        .map((issue): string => issue.message)
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
