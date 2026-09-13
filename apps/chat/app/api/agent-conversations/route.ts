import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { createConversationInput } from "@/lib/eve/contracts";
import { createEveConversationOperation } from "@/lib/eve/create-conversation-operation";
import {
  admitGuestCreation,
  settleGuestCreation,
} from "@/lib/eve/guest-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

export async function POST(request: Request) {
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
  const input = createConversationInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a message between 1 and 16,000 characters." },
      { status: 400 }
    );
  }
  const admission =
    principal.kind === "guest"
      ? await admitGuestCreation(request, principal, input.data)
      : undefined;
  if (admission instanceof Response) {
    return admission;
  }
  const response = await createEveConversationOperation(
    principal.ownerId,
    input.data
  );
  if (admission) {
    await settleGuestCreation(
      response,
      principal.ownerId,
      input.data.operationId,
      admission.reservationId
    );
  }
  return response;
}
