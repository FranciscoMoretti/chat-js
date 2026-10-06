// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { writeFile, access } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { setTimeout as delay } from "node:timers/promises";

import { defineTool } from "eve/tools";
import { z } from "zod";

// oxlint-disable-next-line import/no-relative-parent-imports -- The standalone EVE fixture shares its local barrier helper and has no application alias resolver.
import { fixtureHome } from "../../barrier";

const number600 = 600;
const number1 = 1;
const number25 = 25;

// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default defineTool({
  description: "Wait at a deterministic test-owned barrier",
  execute: async ({ key }) => {
    const root = fixtureHome();
    await writeFile(path.join(root, `${key}.ready`), "ready");
    for (let attempt = 0; attempt < number600; attempt += number1) {
      if (
        // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
        await access(path.join(root, `${key}.release`)).then(
          () => true,
          () => false
        )
      ) {
        return "released";
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
      await delay(number25);
    }
    throw new Error("barrier timeout");
  },
  inputSchema: z.object({ key: z.string() }),
});
