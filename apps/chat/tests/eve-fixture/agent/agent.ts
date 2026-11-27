import { setTimeout as delay } from "node:timers/promises";

import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({
  experimental: { workflow: { world: "@workflow/world-postgres" } },
  model: mockModel(async ({ lastUserMessage, toolResults }) => {
    if (lastUserMessage?.startsWith("slow") === true) {
      await delay(5000);
    }
    if (lastUserMessage === "fail") {
      throw new Error("Deterministic provider failure");
    }
    if (lastUserMessage === "question") {
      if (toolResults.length > 0) {
        return "Answer received.";
      }
      return {
        toolCalls: [
          {
            name: "question",
            input: {},
          },
        ],
      };
    }
    if (lastUserMessage?.startsWith("confirm") === true) {
      if (toolResults.length > 0) {
        return "Approval handled.";
      }
      return {
        toolCalls: [
          {
            name: "confirm",
            input: { note: "Review release" },
          },
        ],
      };
    }
    return `Verified: ${lastUserMessage}`;
  }),
  modelContextWindowTokens: 128_000,
});
