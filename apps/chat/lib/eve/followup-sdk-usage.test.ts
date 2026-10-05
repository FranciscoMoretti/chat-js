import { MockLanguageModelV3 } from "ai/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { generateEveFollowupSuggestions } from "./generate-followup-suggestions";

/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep model's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): model preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const model = new MockLanguageModelV3({
  doGenerate: () =>
    Promise.resolve({
      content: [{ text: "This is not valid JSON", type: "text" }],
      finishReason: { raw: "stop", unified: "stop" },
      providerMetadata: {
        gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
      },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 20, total: 20 },
        outputTokens: { reasoning: 0, text: 10, total: 10 },
      },
      warnings: [],
    }),
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */
/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./model-selection")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): vi.mock("./model-selection") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./model-selection", () => ({
  resolveEveModel: () => Promise.resolve({ model, modelOptions: {} }),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        followupSuggestions: {
          default: "google/gemini-2.5-flash-lite",
          enabled: true,
        },
      },
    },
  },
}));

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("the real AI SDK delivers usage before rejecting invalid structured suggestions") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("the real AI SDK delivers usage before rejecting invalid structured suggestions", async () => {
  const result = await generateEveFollowupSuggestions({
    assistant: "Because.",
    user: "Why?",
  });
  expect(result?.responseMetadata).toBeUndefined();
  expect(result?.modelCalls).toHaveLength(1);
  expect(result?.modelCalls?.[0]).toMatchObject({
    modelId: "google/gemini-2.5-flash-lite",
    providerMetadata: {
      gateway: { cost: "0.00001", generationId: "paid-invalid-output" },
    },
    usage: { inputTokens: 20, outputTokens: 10 },
  });
  expect(result?.modelCalls?.[0].failed).toBeUndefined();
  expect(model.doGenerateCalls).toHaveLength(1);
});
/* oxlint-enable no-magic-numbers */
