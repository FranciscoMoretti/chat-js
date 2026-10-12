import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { filterEveTools } from "../../../../lib/eve/turn-tools";

const confirmNote = defineTool({
  approval: {
    request: always(),
    response: ({ responder, session }) => {
      if (responder.principalId === session.initiator?.principalId) {
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

export default defineDynamic({
  events: {
    "step.started": () => filterEveTools({ confirm_note: confirmNote }),
  },
});
