import {
  issueGuestCredential,
  newGuestClaims,
} from "@/lib/eve/disposable-guest";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { env } from "@/lib/env";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { sameOrigin } from "@/lib/eve/request-policy";
import { z } from "zod";
/* oxlint-disable sort-imports -- Keep config.anonymous validation after env/model/request initialization: config defaults and validation can throw before the original env validation if this binding moves first. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

/* oxlint-enable sort-imports */

const MINIMUM_MODEL_ID_LENGTH = 1;
const GUEST_CREATION_TIMEOUT_MS = 60_000;

const input = z
  .object({ modelId: z.string().min(MINIMUM_MODEL_ID_LENGTH) })
  .strict();

const createdSession = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/u),
});

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, unicorn/no-null -- max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

/**
 * Starts a guest Eve session and returns a browser-safe, session-scoped credential.
 * The creation credential remains server-side; the client keeps the guest credential in memory.
 * @param {Request} request Same-origin request containing the selected guest model.
 * @returns {Promise<Response>} JSON with the guest session details, or an error response.
 */
export const POST = async (
  request: ReadonlyNativeSurface<Request>
): Promise<Response> => {
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
  const hasVercelHost = Boolean(env.VERCEL_URL);
  // oxlint-disable-next-line no-ternary -- Preserve the lazy host selection and second configured VERCEL_URL read; assignment branches conflict with unicorn/prefer-ternary.
  const host = hasVercelHost ? `https://${env.VERCEL_URL}` : env.APP_URL;
  if (typeof host !== "string" || host === "") {
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connection.headers own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...connection.headers,
        authorization: `Bearer ${issueGuestCredential(claims)}`,
        "content-type": "application/json",
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(GUEST_CREATION_TIMEOUT_MS),
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing claims own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      credential: issueGuestCredential({ ...claims, sessionId }),
      expiresAt: claims.expiresAt,
      sessionId,
    },
    { headers: { "cache-control": "no-store" } }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, unicorn/no-null */
