import { eveChannel } from "eve/channels/eve";
import { Client, conversationOf } from "eve/client";
import { activeTurn, idle } from "eve/events";
import { branchHistory } from "../../history-adapter";
import { reservation } from "../../reservations";

export default eveChannel({
  // Synthetic identities only. Production must retain ChatJS's signed gateway auth.
  auth: (request) => ({
    principalId: request.headers.get("x-poc-owner") ?? "poc-owner",
    principalType: "user",
    authenticator: "structured-history-poc",
    attributes: {},
    allowAgentInfo: true,
  }),
  fetchFile: async (url, context) => {
    if (
      context?.session?.auth.current?.principalId !== "poc-owner" ||
      url !== "https://files.invalid/owner/doc"
    ) {
      throw new Error("File is not owned by caller.");
    }
    const content = await Promise.resolve("Document value: 42");
    return Buffer.from(content);
  },
  async onMessage({ eve }) {
    const operation = eve.request.headers.get("x-poc-operation");
    if (operation !== null) {
      if (eve.sessionId !== undefined || !eve.caller) {
        throw new Error("Import only on creation.");
      }
      return {
        auth: eve.caller,
        history: reservation(eve.caller.principalId, operation),
      };
    }
    const source = eve.request.headers.get("x-poc-source");
    if (source === null || source === "") {
      return { auth: eve.caller };
    }
    if (eve.sessionId !== undefined) {
      throw new Error("History can only initialize a new branch.");
    }
    if (!eve.caller) {
      throw new Error("Authentication required.");
    }
    const client = new Client({
      baseUrl: new URL(eve.request.url).origin,
      headers: { "x-poc-owner": eve.caller.principalId },
    });
    const snapshot = await client.sessions.attach(source).snapshot();
    // The real app uses its owner-scoped source reservation. This disposable
    // fixture derives its synthetic owner from positive native admission evidence.
    const admitted = snapshot.events.find(
      (event) => event.type === "delivery.admitted"
    );
    if (
      admitted?.type !== "delivery.admitted" ||
      admitted.data.principal?.id !== eve.caller.principalId
    ) {
      throw new Error("Source conversation is not owned by this caller.");
    }
    const conversation = conversationOf(snapshot.events);
    if (!idle(conversation.view) || activeTurn(conversation.view)) {
      throw new Error("Wait for the source turn to finish.");
    }
    return {
      auth: eve.caller,
      history: branchHistory(
        conversation.messages,
        eve.request.headers.get("x-poc-before") ?? undefined
      ),
    };
  },
});
