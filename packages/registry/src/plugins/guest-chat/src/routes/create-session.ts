import { requireEveDeletionLifecycle } from "@/lib/eve/deletion-lifecycle";
import { readGuestBody } from "@/plugins/guest-chat/guest-body";
import {
  createGuestRuntimeSession,
  bindGuestRuntimeSession,
} from "@/plugins/guest-chat/guest-queries";
import { guestRequestIpHash } from "@/plugins/guest-chat/guest-ip";
import { GUEST_POLICY } from "@/plugins/guest-chat/guest-policy";
import {
  issueGuestCredential,
  newGuestClaims,
} from "@/plugins/guest-chat/guest-credential";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { env } from "@/lib/env";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { sameOrigin } from "@/lib/eve/request-policy";
import { z } from "zod";

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
  const value = input.safeParse(await readGuestBody(request));
  if (!value.success || value.data.modelId !== GUEST_POLICY.modelId) {
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
  try {
    // Never admit temporary data unless this deployment can later erase it.
    await requireEveDeletionLifecycle().check();
  } catch {
    return Response.json(
      {
        error:
          "Guest retention is unavailable. Please sign in or try again later.",
      },
      { status: 503 }
    );
  }
  await loadEveModelDefinition(value.data.modelId);
  let ipHash: string;
  try {
    ipHash = guestRequestIpHash(request);
  } catch {
    return Response.json(
      { error: "Guest admission is unavailable." },
      { status: 503 }
    );
  }
  const claims = newGuestClaims(GUEST_POLICY.modelId);
  const admission = await createGuestRuntimeSession({
    ownerId: claims.ownerId,
    modelId: GUEST_POLICY.modelId,
    ipHash,
    credentialExpiresAt: new Date(claims.expiresAt),
    requestsPerMinute: GUEST_POLICY.requestsPerMinute,
    sessionsPerHour: GUEST_POLICY.sessionsPerHour,
  });
  if (admission.status !== "ready") {
    return Response.json(
      { error: "Guest limit reached. Please try again later or sign in." },
      { status: 429 }
    );
  }
  claims.policyId = admission.guest.id;
  const connection = getEveConnectionOptions(
    claims.ownerId,
    new URL(host).origin
  );
  const response = await fetch(
    new URL("/eve/chat/v1/session", connection.host),
    {
      body: JSON.stringify({ operationId: claims.policyId }),
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
  if (
    !(await bindGuestRuntimeSession(claims.policyId, claims.ownerId, sessionId))
  ) {
    return Response.json(
      { error: "Could not bind guest session. Please try again." },
      { status: 502 }
    );
  }
  return Response.json(
    {
      credential: issueGuestCredential({ ...claims, sessionId }),
      expiresAt: claims.expiresAt,
      sessionId,
    },
    { headers: { "cache-control": "no-store" } }
  );
};
