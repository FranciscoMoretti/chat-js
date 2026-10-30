import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { after } from "next/server";
import { env } from "@/lib/env";
import {
  conversationBinding,
  createConversationInput,
} from "@/lib/eve/contracts";
import { runChatAfterCreate } from "@/lib/chat-after-create";
import { createEveConversationOperation } from "@/lib/eve/create-conversation-operation";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

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
  const input = createConversationInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a message between 1 and 16,000 characters." },
      { status: 400 }
    );
  }
  const response = await createEveConversationOperation(
    principal.ownerId,
    input.data
  );
  if (response.ok && !input.data.fork) {
    const binding = conversationBinding.safeParse(
      await response
        .clone()
        .json()
        .catch(() => null)
    );
    if (binding.success) {
      after(async () => {
        await runChatAfterCreate({
          conversationId: binding.data.id,
          message: input.data.message,
          ownerId: principal.ownerId,
        });
      });
    }
  }
  return response;
};
