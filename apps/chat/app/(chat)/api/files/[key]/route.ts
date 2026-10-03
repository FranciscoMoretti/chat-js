/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { canReadEveFile } from "@/lib/db/eve-files";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { createFileContentResponse } from "@/lib/file-content-response";
import { isFileStorageKey } from "@/lib/file-url";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- GET: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including principal?.ownerId); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: Request). */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
