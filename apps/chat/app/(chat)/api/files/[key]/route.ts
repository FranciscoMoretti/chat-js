import { canReadEveFile } from "@/lib/db/eve-files";
import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createFileContentResponse } from "@/lib/file-content-response";
/* oxlint-enable sort-imports */
import { isFileStorageKey } from "@/lib/file-url";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- GET: ; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: Request). */

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) => {
  const { key } = await params;
  if (!isFileStorageKey(key)) {
    return new Response("Invalid file key", { status: 400 });
  }
  const principal = await resolveEvePrincipal(request.headers);
  const access = await canReadEveFile(key, principal?.ownerId);
  if (!(access.allowed && access.managed)) {
    return new Response("File not found", {
      headers: { "Cache-Control": "private, no-store" },
      status: 404,
    });
  }
  // Authorization is rechecked before issuing each short-lived download URL.
  return await createFileContentResponse(request, key, {
    allowRedirect: true,
  });
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
