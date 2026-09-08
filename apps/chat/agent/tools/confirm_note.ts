// biome-ignore-all lint/style/useFilenamingConvention: Eve uses the filename as the public tool name.
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { noteInput } from "../../lib/eve/contracts";

export default defineTool({
  description:
    "Confirm a short note after explicit human approval. No external side effects.",
  inputSchema: noteInput,
  approval: {
    request: always(),
    response: ({ responder, session }) =>
      responder.principalId === session.initiator?.principalId
        ? { status: "allowed" }
        : { status: "rejected", reason: "Only the owner may respond" },
  },
  execute: ({ note }) => Promise.resolve({ note, confirmed: true }),
});
