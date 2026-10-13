import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Return a deterministic effect receipt",
  execute: (input, ctx) => ({
    callId: ctx.callId,
    message: input.message,
    sessionId: ctx.session.id,
  }),
  inputSchema: z.object({ message: z.string() }),
});
