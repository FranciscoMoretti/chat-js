/* oxlint-disable eslint/no-magic-numbers -- Zero results selects the one deterministic deletion call. */
/* oxlint-disable import/no-relative-parent-imports -- The mock model imports the fixture action input. */
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

import { input } from "../proof/input";

// oxlint-disable-next-line import/no-default-export -- EVE discovers this fixture through its default export.
export default defineAgent({
  defaultTools: false,
  model: mockModel(({ toolResults }) =>
    toolResults.length > 0
      ? "Finished."
      : { toolCalls: [{ input, name: "deleteDocument" }] }
  ),
  modelContextWindowTokens: 128_000,
});

/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-enable eslint/no-magic-numbers */
