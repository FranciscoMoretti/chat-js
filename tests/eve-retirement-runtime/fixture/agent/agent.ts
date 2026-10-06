import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

// oxlint-disable-next-line import/no-default-export -- EVE discovers the authored agent through its default export.
export default defineAgent({
  defaultTools: false,
  description: "Isolated retirement proof agent",
  model: mockModel(({ lastUserMessage, toolResults, userMessageCount }) =>
    toolResults.length >= userMessageCount
      ? "Recorded by the runtime."
      : { toolCalls: [{ input: { message: lastUserMessage }, name: "record" }] }
  ),
  modelContextWindowTokens: 128_000,
});
