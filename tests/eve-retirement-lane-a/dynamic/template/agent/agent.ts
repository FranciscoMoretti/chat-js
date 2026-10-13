import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

import { input } from "../proof/input";

export default defineAgent({
  defaultTools: false,
  model: mockModel(({ toolResults }) =>
    toolResults.length > 0
      ? "Finished."
      : { toolCalls: [{ input, name: "deleteDocument" }] }
  ),
  modelContextWindowTokens: 128_000,
});
