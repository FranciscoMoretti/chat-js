import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";

export default defineWorkflowTool({
  description: "Ask the user a freeform fixture question.",
  inputSchema: z.object({}),
  async execute(_input, context) {
    "use workflow";
    return await context.ask({
      allowFreeform: true,
      prompt: "What should the note say?",
    });
  },
});
