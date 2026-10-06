import { defineTool } from "eve/tools";
import { z } from "zod";

// oxlint-disable-next-line import/no-default-export -- EVE discovers authored tools through their default exports.
export default defineTool({
  description: "Return a deterministic effect receipt",
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- EVE supplies the tool context; the fixture reads its identity without cloning it.
  execute: (input, ctx) => ({
    callId: ctx.callId,
    message: input.message,
    sessionId: ctx.session.id,
  }),
  inputSchema: z.object({ message: z.string() }),
});
