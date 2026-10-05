import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isUnacceptedEveCopy } from "@/lib/db/eve-copy-journal";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveDeletionState } from "@/lib/db/eve-deletion";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { deleteLocalEveConversationFamily } from "@/lib/eve/delete-local-conversation";
/* oxlint-enable sort-imports */
import { deleteUnacceptedEveCopy } from "@/lib/eve/delete-unaccepted-copy";
import { localDeletionAvailable } from "@/lib/eve/local-deletion-available";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

const headers = { "cache-control": "no-store" };
interface Context {
  params: Promise<{ id: string }>;
}

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep authorize's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): authorize accepts request: Request; context: Context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): authorize preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const authorize = async (request: Request, context: Context) => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { headers, status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { headers, status: 400 });
  }
  const source = await getEveDeletionState(principal.ownerId, id);
  if (!source) {
    return new Response(null, { headers, status: 404 });
  }
  return { id, ownerId: principal.ownerId, source };
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep deletionStatus's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const deletionStatus = (state: string) => {
  if (state === "deleted") {
    return "deleted";
  }
  if (state === "deleting") {
    return "pending";
  }
  return "active";
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): GET's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): GET's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/prefer-readonly-parameter-types (#565): GET accepts request: Request; context: Context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Status only; reading never resumes deletion or exposes conversation payloads. */
const GET = async (request: Request, context: Context): Promise<Response> => {
  const result = await authorize(request, context);
  if (result instanceof Response) {
    return result;
  }
  return Response.json(
    {
      rootId: result.source.rootId,
      status: deletionStatus(result.source.state),
    },
    { headers }
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, unicorn/no-null -- jsdoc/require-param (#534): DELETE's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): DELETE's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): DELETE keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): DELETE keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): DELETE accepts request: Request; context: Context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): DELETE preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Erases the conversation family through the verified local-provider coordinator. */
const DELETE = async (
  request: Request,
  context: Context
): Promise<Response> => {
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { headers, status: 403 });
  }
  const result = await authorize(request, context);
  if (result instanceof Response) {
    return result;
  }
  const { ownerId, id, source } = result;
  if (source.state === "deleted") {
    return Response.json(
      { rootId: source.rootId, status: "deleted" },
      { headers }
    );
  }
  try {
    if (await isUnacceptedEveCopy(ownerId, id)) {
      await deleteUnacceptedEveCopy(ownerId, id);
      return Response.json(
        { rootId: source.rootId, status: "deleted" },
        { headers }
      );
    }
    // Hosted native erasure is not implemented. Reject before revoking access.
    if (!localDeletionAvailable()) {
      return Response.json(
        { error: "Deletion is not available for this provider configuration." },
        { headers, status: 503 }
      );
    }
    const deleted = await deleteLocalEveConversationFamily(
      ownerId,
      id,
      process.cwd()
    );
    if (!deleted) {
      return new Response(null, { headers, status: 404 });
    }
    return Response.json(
      { rootId: deleted.rootId, status: "deleted" },
      { headers }
    );
  } catch {
    const current = await getEveDeletionState(ownerId, id);
    if (current?.state === "deleted") {
      return Response.json(
        { rootId: current.rootId, status: "deleted" },
        { headers }
      );
    }
    if (current?.state === "deleting") {
      return Response.json(
        {
          error: "Deletion is incomplete. Retry to continue cleanup.",
          retryRequired: true,
          rootId: current.rootId,
          status: "pending",
        },
        { headers, status: 202 }
      );
    }
    return Response.json(
      {
        error: "Resolve pending conversation work before deleting.",
        status: "not_started",
      },
      { headers, status: 409 }
    );
  }
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, unicorn/no-null */
export { DELETE, GET };
