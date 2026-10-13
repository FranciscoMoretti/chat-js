import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { defineTool } from "eve/tools";
import { z } from "zod";
import { fixtureHome } from "../../barrier";

const number600 = 600;
const number1 = 1;
const number25 = 25;
export default defineTool({
  description: "Wait at a deterministic test-owned barrier",
  execute: async ({ key }) => {
    const root = fixtureHome();
    await writeFile(path.join(root, `${key}.ready`), "ready");
    for (let attempt = 0; attempt < number600; attempt += number1) {
      if (
        // oxlint-disable-next-line no-await-in-loop -- Poll the test barrier after each delay; concurrent attempts would release the test too early.
        await access(path.join(root, `${key}.release`)).then(
          () => true,
          () => false
        )
      ) {
        return "released";
      }
      // oxlint-disable-next-line no-await-in-loop -- Poll the test barrier after each delay; concurrent attempts would release the test too early.
      await delay(number25);
    }
    throw new Error("barrier timeout");
  },
  inputSchema: z.object({ key: z.string() }),
});
