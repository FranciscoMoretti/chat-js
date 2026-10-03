/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named GET API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): GET remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-ternary (#518): GET derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): GET sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null */
