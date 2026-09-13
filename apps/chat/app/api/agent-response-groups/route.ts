import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { admitGuestResponseGroup } from "@/lib/eve/guest-group-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { createEveResponseGroup } from "@/lib/eve/response-group";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";

export const POST = async (request: Request) => {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
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
    return Response.json(
      eveResponseGroupResult.parse(
        await createEveResponseGroup(principal.ownerId, input.data, admission)
      )
    );
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
