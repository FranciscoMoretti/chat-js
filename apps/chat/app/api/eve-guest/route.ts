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
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

const MINIMUM_MODEL_ID_LENGTH = 1;
const GUEST_CREATION_TIMEOUT_MS = 60_000;

const hasConfiguredHost = (value: typeof env.APP_URL): value is string =>
  Boolean(value);

const input = z
  .object({ modelId: z.string().min(MINIMUM_MODEL_ID_LENGTH) })
  .strict();

const createdSession = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/u),
});

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
  const host = hasVercelHost ? `https://${env.VERCEL_URL}` : env.APP_URL;
  if (!hasConfiguredHost(host)) {
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
      credential: issueGuestCredential({ ...claims, sessionId }),
      expiresAt: claims.expiresAt,
      sessionId,
    },
    { headers: { "cache-control": "no-store" } }
  );
};
