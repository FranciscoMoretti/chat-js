import { z } from "zod";
import { conversationBinding, type createConversationInput } from "./contracts";

export class CreationRejected extends Error {}

/** A timeout is ambiguous: callers must retain the operation until it is bound. */
export async function requestConversation(
  operation: z.infer<typeof createConversationInput>
) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("/api/agent-conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(operation),
      signal: controller.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const failure = z
        .object({ error: z.string(), creationRejected: z.boolean().optional() })
        .parse(body);
      if (response.status === 400 && failure.creationRejected === true) {
        throw new CreationRejected(failure.error);
      }
      throw new Error(failure.error);
    }
    return conversationBinding.parse(body);
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error(
        "The request timed out. Your message is saved. Retry to check the same conversation."
      );
    }
    throw cause;
  } finally {
    clearTimeout(deadline);
  }
}
