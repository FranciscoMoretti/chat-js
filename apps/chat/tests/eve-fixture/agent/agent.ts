/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

/* oxlint-disable import/no-default-export, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/strict-boolean-expressions, typescript/strict-void-return --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * max-statements (#512): default export keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): default export uses 5000, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): default export derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): default export sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): default export handles optional lastUserMessage?.startsWith("slow"); lastUserMessage?.startsWith("confirm"); tool?.name without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of lastUserMessage?.startsWith("slow"); lastUserMessage?.startsWith("confirm"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): default export's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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
      if (toolResults.length > 0) {
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
      if (toolResults.length > 0) {
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
/* oxlint-enable import/no-default-export, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/strict-boolean-expressions, typescript/strict-void-return */
