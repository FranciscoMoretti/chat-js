import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  approval: {
    request: always(),
    response: ({ response, session }) => {
      if (response.principal.principalId === session.initiator?.principalId) {
        return { status: "allowed" };
      }
      return { reason: "Only the owner may respond", status: "rejected" };
    },
  },
  description:
    "Confirm a short note after explicit human approval. No external side effects.",
  execute: ({ note }) => ({ confirmed: true, note }),
  inputSchema: z.object({
    note: z.string().trim().min(1).max(500),
  }),
});
