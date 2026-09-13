/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({
  experimental: { workflow: { world: "@workflow/world-postgres" } },
  model: mockModel(async ({ lastUserMessage, toolResults, tools }) => {
    if (lastUserMessage?.startsWith("slow")) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (lastUserMessage === "fail") {
      throw new Error("Deterministic provider failure");
    }
    if (lastUserMessage === "question") {
      if (toolResults.length) {
        return "Answer received.";
      }
      return {
        toolCalls: [
          {
            name: "ask_question",
            input: { prompt: "What should the note say?", allowFreeform: true },
          },
        ],
      };
    }
    if (lastUserMessage?.startsWith("confirm")) {
      if (toolResults.length) {
        return "Approval handled.";
      }
      const tool = tools.find((item) => item.name === "confirm_note");
      return {
        toolCalls: [
          {
            name: tool?.name ?? "run_tool",
            input: tool
              ? { note: "Review release" }
              : { name: "confirm_note", input: { note: "Review release" } },
          },
        ],
      };
    }
    return `Verified: ${lastUserMessage}`;
  }),
  modelContextWindowTokens: 128_000,
});
