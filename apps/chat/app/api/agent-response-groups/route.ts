import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { after } from "next/server";
import { env } from "@/lib/env";
import { persistGeneratedEveConversationTitle } from "@/lib/eve/conversation-title";
// oxlint-disable-next-line sort-imports -- Preserve the transitive initializer sequence recorded for this declaration in the exact import-graph audit; the adjacent sorted swap changes that sequence.
import { admitGuestResponseGroup } from "@/lib/eve/guest-group-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
// oxlint-disable-next-line sort-imports -- Preserve the transitive initializer sequence recorded for this declaration in the exact import-graph audit; the adjacent sorted swap changes that sequence.
import { createEveResponseGroup } from "@/lib/eve/response-group";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";

// Initial comparison candidates share a logical chat. Schedule its title from
// the bound primary candidate while retaining deferred message/owner reads.
/* oxlint-disable typescript/promise-function-async -- Next after receives the existing callback promise directly, preserving synchronous throws and promise identity. */
const scheduleResponseGroupTitle = (
  result: ReadonlyNativeSurface<
    ReturnType<typeof eveResponseGroupResult.parse>
  >,
  input: ReadonlyNativeSurface<
    Extract<
      ReturnType<typeof eveResponseGroupInput.safeParse>,
      { success: true }
    >
  >,
  principal: Readonly<
    NonNullable<Awaited<ReturnType<typeof resolveEvePrincipal>>>
  >
): void => {
  if (!input.data.fork) {
    const source = result.candidates.find(
      (candidate) => candidate.state === "bound"
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (source?.state === "bound") {
      after(() =>
        persistGeneratedEveConversationTitle({
          conversationId: source.conversationId,
          message: input.data.message,
          ownerId: principal.ownerId,
        })
      );
    }
  }
};
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-statements, no-undefined, unicorn/no-null --
max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): POST uses undefined for absent or optional values; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

export const POST = async (
  request: ReadonlyNativeSurface<Request>
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const input = eveResponseGroupInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Invalid response group request." },
      { status: 400 }
    );
  }
  try {
    const admission =
      // oxlint-disable-next-line no-ternary -- Keep admission as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      principal.kind === "guest"
        ? await admitGuestResponseGroup(request, principal, input.data)
        : undefined;
    if (admission instanceof Response) {
      return admission;
    }
    const result = eveResponseGroupResult.parse(
      await createEveResponseGroup(principal.ownerId, input.data, admission)
    );
    scheduleResponseGroupTitle(result, input, principal);
    return Response.json(result);
  } catch {
    return Response.json(
      {
        error:
          "Response group is unavailable or unresolved. Retain the original request before retrying.",
      },
      { status: 409 }
    );
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-undefined, unicorn/no-null */
