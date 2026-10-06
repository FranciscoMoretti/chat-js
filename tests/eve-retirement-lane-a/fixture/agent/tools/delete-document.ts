/* oxlint-disable typescript/prefer-readonly-parameter-types -- The response and executor callbacks receive EVE-owned contexts and do not mutate them. */
import { defineTool } from "eve/tools";
import { z } from "zod";

// This native-only fixture deliberately has no runtime receipt dependency.
// Production keeps its receipt gate until integration covers the real DB mutation.
// oxlint-disable-next-line import/no-default-export -- EVE discovers the fixture tool by default export.
export default defineTool({
  approval: {
    request: () => "user-approval",
    response: ({ response, session }) =>
      response.principal.principalId === session.initiator?.principalId
        ? { status: "allowed" }
        : {
            reason: "Only the owner may approve or cancel.",
            status: "rejected",
          },
  },
  description: "Delete only after exact owner approval",
  execute: (input, context) => {
    context.abortSignal.throwIfAborted();
    return {
      callId: context.callId,
      deleted: true,
      documentId: input.documentId,
      sessionId: context.session.id,
    };
  },
  inputSchema: z.object({
    documentId: z.string(),
    expectedRevisionId: z.string(),
    title: z.string(),
  }),
});

/* oxlint-enable typescript/prefer-readonly-parameter-types */
