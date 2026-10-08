import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
/* oxlint-enable sort-imports */
import { resolveEvePrincipal } from "@/lib/eve/principal";
// oxlint-disable-next-line sort-imports -- This readonly view preserves the native request/session members and follows the existing runtime import group.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (GET); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- { params, }: { params: Promise<{ id: string; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): GET preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

export const GET = async (
  request: ReadonlyNativeSurface<Pick<Request, "headers">>,
  {
    params,
  }: {
    readonly params: Readonly<
      Promise<{
        readonly id: string;
      }>
    >;
  }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 });
  }
  const group = await getEveResponseGroup(principal.ownerId, id);

  if (group) {
    return Response.json(group, {
      headers: { "cache-control": "private, no-store" },
    });
  }
  return new Response(null, { status: 404 });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
