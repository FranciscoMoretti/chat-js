/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { responseModel } from "./response-model";
/* oxlint-enable sort-imports */

const step = {
  data: {
    modelId: "gateway/anthropic/claude-sonnet-reasoning",
    sequence: 2,
    stepIndex: 0,
    turnId: "turn_0",
  },
  meta: { at: "2026-09-10T00:00:00Z", id: "step" },
  type: "step.started",
} satisfies MessageStreamEvent;

/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): it("preserves the response selection across reload and restored ancestor history") copies or separates ...step; ...step.data while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("preserves the response selection across reload and restored ancestor history", () => {
  expect(responseModel([step], "turn_0")).toBe(
    "anthropic/claude-sonnet-reasoning"
  );
  expect(
    responseModel(
      [
        {
          data: {
            beforeTurnId: "turn_1",
            events: [step],
            sourceSessionId: "source",
          },
          meta: { at: step.meta.at, id: "history" },
          type: "history.restored",
        },
        {
          ...step,
          data: {
            ...step.data,
            modelId: "gateway/openai/gpt-4.1",
            turnId: "turn_1",
          },
        },
      ],
      "turn_0"
    )
  ).toBe("anthropic/claude-sonnet-reasoning");
});
/* oxlint-enable oxc/no-rest-spread-properties */
it("refuses to silently substitute another model when the response evidence is missing", () => {
  expect(() => responseModel([step], "turn_7")).toThrow(
    "response model is unavailable"
  );
});

it("uses retained imported provenance without substituting missing native evidence", () => {
  expect(responseModel([], "", "gateway/google/gemini-2.5-flash-lite")).toBe(
    "google/gemini-2.5-flash-lite"
  );
  expect(() =>
    responseModel([], "turn_0", "gateway/google/gemini-2.5-flash-lite")
  ).toThrow();
  expect(() => responseModel([], "", "missing-provider")).toThrow();
});
