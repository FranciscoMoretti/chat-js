import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConversation } from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  readEveCheckpoint,
  waitForEveCheckpoint,
} from "@/lib/eve/checkpoint-readiness";
/* oxlint-enable sort-imports */
import { CheckpointRejectedError } from "@/lib/eve/checkpoint-rejection";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveRequest } from "@/lib/eve/server";
// oxlint-disable-next-line sort-imports -- This readonly view preserves the native request/session members and follows the existing runtime import group.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-enable sort-imports */

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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null -- max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): POST uses 15_000, 202 in its existing protocol/math/layout contract; context: { params: Promise<{ id: string; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of source?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

/**
 * Requests checkpoint capture for a bound source conversation.
 * On an ambiguous response, the caller must retain this request for a same-request retry.
 * @param {Request} request Same-origin request containing checkpoint identity and turn data.
 * @param {{ params: Promise<{ id: string }> }} context Route parameters containing the conversation ID.
 * @returns {Promise<Response>} JSON confirming readiness or explaining rejection or uncertainty.
 */
export const POST = async (
  request: ReadonlyNativeSurface<Request>,
  context: {
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input.data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input.data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null */
