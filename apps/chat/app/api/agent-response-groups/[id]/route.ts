import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
/* oxlint-enable sort-imports */
import { resolveEvePrincipal } from "@/lib/eve/principal";

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): GET accepts request: Request; { params, }: { params: Promise<{ id: string; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): GET preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const GET = async (
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
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
  return group
    ? Response.json(group, {
        headers: { "cache-control": "private, no-store" },
      })
    : new Response(null, { status: 404 });
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
