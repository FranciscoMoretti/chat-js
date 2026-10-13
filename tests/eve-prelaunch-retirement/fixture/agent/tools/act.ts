import { appendFile } from "node:fs/promises";

import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  approval: { request: () => "user-approval" },
  description: "Never run an unapproved old action during retirement",
  execute: async (input) => {
    await appendFile("effects.jsonl", `${JSON.stringify(input)}\n`);
    return input;
  },
  inputSchema: z.object({ amount: z.coerce.number() }),
});
