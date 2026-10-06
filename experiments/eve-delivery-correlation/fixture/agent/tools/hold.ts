import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";

import { defineTool } from "eve/tools";
import { z } from "zod";
export default defineTool({
  description: "Wait at a deterministic test-owned barrier",
  inputSchema: z.object({ key: z.string() }),
  execute: async ({ key }) => {
    const root = process.env.HOME!;
    await writeFile(join(root, `${key}.ready`), "ready");
    for (let attempt = 0; attempt < 600; attempt++) {
      if (
        await access(join(root, `${key}.release`)).then(
          () => true,
          () => false
        )
      )
        return "released";
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("barrier timeout");
  },
});
