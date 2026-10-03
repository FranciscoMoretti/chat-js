import { z } from "zod";

import { getEveConversation } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import {
  readEveCheckpoint,
  waitForEveCheckpoint,
} from "@/lib/eve/checkpoint-readiness";
import { CheckpointRejectedError } from "@/lib/eve/checkpoint-rejection";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): inputSchema uses 64 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const inputSchema = z
  .object({
    beforeTurnId: z
      .string()
      .max(64)
      .regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u),
    checkpointId: z.uuid(),
  })
  .strict();
/* oxlint-enable no-magic-numbers */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named POST API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): POST remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): POST's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): POST's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): POST uses 15_000, 202 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): POST sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): POST handles optional source?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): POST copies or separates ...input.data while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): POST accepts request: Request; context: { params: Promise<{ id: string; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of source?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** The caller retains this checkpoint identity before posting and on ambiguous failure. */
export const POST = async (
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const { id } = await context.params;
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!(z.uuid().safeParse(id).success && input.success)) {
    return Response.json(
      { error: "Invalid checkpoint request." },
      { status: 400 }
    );
  }
  const source = await getEveConversation(principal.ownerId, id);
  if (!source?.sessionId || source.state !== "bound") {
    return Response.json(
      { error: "Source conversation not found." },
      { status: 404 }
    );
  }
  try {
    if (
      !(await readEveCheckpoint(
        principal.ownerId,
        source.sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      ))
    ) {
      const accepted = await eveRequest(
        principal.ownerId,
        `/eve/chat/v1/session/${encodeURIComponent(source.sessionId)}/checkpoint`,
        {
          body: JSON.stringify(input.data),
          method: "POST",
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (accepted.status !== 202) {
        throw new Error("Checkpoint capture was not accepted.");
      }
      await waitForEveCheckpoint(
        principal.ownerId,
        source.sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      );
    }
    return Response.json(
      { conversationId: id, ready: true, ...input.data },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CheckpointRejectedError) {
      return Response.json(
        {
          checkpointRejected: true,
          conversationId: id,
          error: error.message,
          reason: error.reason,
          ...input.data,
        },
        { headers: { "cache-control": "no-store" }, status: 409 }
      );
    }
    return Response.json(
      {
        error:
          "Checkpoint capture is unconfirmed. Retain this request before retrying.",
      },
      { headers: { "cache-control": "no-store" }, status: 409 }
    );
  }
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
