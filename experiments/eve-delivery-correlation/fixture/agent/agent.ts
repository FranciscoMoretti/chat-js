import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

const noToolResults = 0;
export default defineAgent({
  defaultTools: false,
  description: "Lane C correlation experiment",
  model: mockModel(({ lastUserMessage, toolResults }) =>
    lastUserMessage?.startsWith("hold-") === true &&
    toolResults.length === noToolResults
      ? { toolCalls: [{ input: { key: lastUserMessage }, name: "hold" }] }
      : "Done."
  ),
  modelContextWindowTokens: 128_000,
});
