import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { after } from "next/server";
import { env } from "@/lib/env";
import { runChatAfterCreate } from "@/lib/chat-plugins";
import { admitGuestResponseGroup } from "@/lib/eve/guest-group-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { createEveResponseGroup } from "@/lib/eve/response-group";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";

// Initial comparison candidates share a logical chat. Schedule optional work from
// the bound primary candidate while retaining deferred message/owner reads.
const scheduleResponseGroupContributions = (
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
    if (source?.state === "bound") {
      after(async () => {
        await runChatAfterCreate({
          conversationId: source.conversationId,
          message: input.data.message,
          ownerId: principal.ownerId,
        });
      });
    }
  }
};

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
      principal.kind === "guest"
        ? await admitGuestResponseGroup(request, principal, input.data)
        : undefined;
    if (admission instanceof Response) {
      return admission;
    }
    const result = eveResponseGroupResult.parse(
      await createEveResponseGroup(principal.ownerId, input.data, admission)
    );
    scheduleResponseGroupContributions(result, input, principal);
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
