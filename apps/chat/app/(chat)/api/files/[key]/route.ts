import { canReadEveFile } from "@/lib/db/eve-files";
import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createFileContentResponse } from "@/lib/file-content-response";
/* oxlint-enable sort-imports */
import { isFileStorageKey } from "@/lib/file-url";
// oxlint-disable-next-line sort-imports -- This readonly view preserves the native request/session members and follows the existing runtime import group.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (GET); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- GET: ; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const GET = async (
  request: ReadonlyNativeSurface<Request>,
  { params }: { readonly params: Readonly<Promise<{ readonly key: string }>> }
) => {
  const { key } = await params;
  if (!isFileStorageKey(key)) {
    return new Response("Invalid file key", { status: 400 });
  }
  const principal = await resolveEvePrincipal(request.headers);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
