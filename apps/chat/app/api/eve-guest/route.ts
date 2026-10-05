import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  issueGuestCredential,
  newGuestClaims,
} from "@/lib/eve/disposable-guest";
/* oxlint-enable sort-imports */
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { sameOrigin } from "@/lib/eve/request-policy";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): input uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const input = z.object({ modelId: z.string().min(1) }).strict();
/* oxlint-enable no-magic-numbers */
const createdSession = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/u),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * jsdoc/require-param (#534): POST's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): POST's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): POST uses 60_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): POST accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of env.VERCEL_URL; host; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** The creation credential stays on the server. The browser receives only a
 * session-scoped credential, which it keeps in memory. */
export const POST = async (request: Request): Promise<Response> => {
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const value = input.safeParse(await request.json().catch(() => null));
  if (
    !value.success ||
    !ANONYMOUS_LIMITS.AVAILABLE_MODELS.some((id) => id === value.data.modelId)
  ) {
    return Response.json(
      { error: "Choose an available guest model." },
      { status: 400 }
    );
  }
  const host = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.APP_URL;
  if (!host) {
    return Response.json(
      { error: "Configure APP_URL before starting guest chats." },
      { status: 503 }
    );
  }
  await loadEveModelDefinition(value.data.modelId);
  const claims = newGuestClaims(value.data.modelId);
  const connection = getEveConnectionOptions(
    claims.ownerId,
    new URL(host).origin
  );
  const response = await fetch(
    new URL("/eve/guest/v1/session", connection.host),
    {
      body: "{}",
      cache: "no-store",
      headers: {
        ...connection.headers,
        authorization: `Bearer ${issueGuestCredential(claims)}`,
        "content-type": "application/json",
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!response.ok) {
    return Response.json(
      { error: "Could not start chat. Please try again." },
      { status: 502 }
    );
  }
  const { sessionId } = createdSession.parse(await response.json());
  return Response.json(
    {
      credential: issueGuestCredential({ ...claims, sessionId }),
      expiresAt: claims.expiresAt,
      sessionId,
    },
    { headers: { "cache-control": "no-store" } }
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
