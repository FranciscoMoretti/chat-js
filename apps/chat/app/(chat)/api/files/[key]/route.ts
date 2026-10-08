import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { canReadEveFile } from "@/lib/db/eve-files";
import { resolveEvePrincipal } from "@/lib/eve/principal";
// oxlint-disable-next-line sort-imports -- Preserve the transitive initializer sequence recorded for this declaration in the exact import-graph audit; the adjacent sorted swap changes that sequence.
import { createFileContentResponse } from "@/lib/file-content-response";
import { isFileStorageKey } from "@/lib/file-url";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (GET); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */

export const GET = async (
  request: ReadonlyNativeSurface<Request>,
  { params }: { readonly params: Readonly<Promise<{ readonly key: string }>> }
): Promise<Response> => {
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
