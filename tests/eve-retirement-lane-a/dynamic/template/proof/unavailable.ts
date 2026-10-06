import { defineTool } from "eve/tools";
import { z } from "zod";

export const unavailable = defineTool({
  description: "Not selected in the deletion proof",
  execute: () => {
    throw new Error("Unexpected unrelated tool execution");
  },
  inputSchema: z.object({}),
});
