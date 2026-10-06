import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({
  defaultTools: false,
  description: "Lane C correlation experiment",
  model: mockModel(({ lastUserMessage, toolResults }) =>
    lastUserMessage.startsWith("hold-") && toolResults.length === 0
      ? { toolCalls: [{ name: "hold", input: { key: lastUserMessage } }] }
      : "Done."
  ),
  modelContextWindowTokens: 128_000,
});
