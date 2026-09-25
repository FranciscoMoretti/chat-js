import { z } from "zod";

import { env } from "@/lib/env";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import {
  issueGuestCredential,
  newGuestClaims,
} from "@/lib/eve/disposable-guest";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { sameOrigin } from "@/lib/eve/request-policy";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

const input = z.object({ modelId: z.string().min(1) }).strict();
const createdSession = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/u),
});

/** The creation credential stays on the server. The browser receives only a
 * session-scoped credential, which it keeps in memory. */
export const POST = async (request: Request) => {
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
  await loadEveModelDefinition(value.data.modelId);
  const claims = newGuestClaims(value.data.modelId);
  const connection = getEveConnectionOptions(
    claims.ownerId,
    new URL(env.APP_URL ?? request.url).origin
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
