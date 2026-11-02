import type { SessionStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { responseModel } from "./response-model";

const step = {
  data: {
    modelId: "anthropic/claude-sonnet-reasoning",
    runId: "run",
    attempt: 0,
  },
  scope: { turnId: "turn_0" },
  meta: { at: "2026-09-10T00:00:00Z", position: { line: 0, index: 0 } },
  type: "model.started",
} satisfies SessionStreamEvent;

it("preserves the response selection across reload and subsequent turns", () => {
  expect(responseModel([step], "turn_0")).toBe(
    "anthropic/claude-sonnet-reasoning"
  );
  expect(
    responseModel(
      [
        step,
        {
          ...step,
          scope: { turnId: "turn_1" },
          data: {
            ...step.data,
            modelId: "openai/gpt-4.1",
          },
        },
      ],
      "turn_0"
    )
  ).toBe("anthropic/claude-sonnet-reasoning");
});
it("refuses to silently substitute another model when the response evidence is missing", () => {
  expect(() => responseModel([step], "turn_7")).toThrow(
    "response model is unavailable"
  );
});

it("uses retained imported provenance without substituting missing native evidence", () => {
  expect(responseModel([], "", "google/gemini-2.5-flash-lite")).toBe(
    "google/gemini-2.5-flash-lite"
  );
  expect(() =>
    responseModel([], "turn_0", "google/gemini-2.5-flash-lite")
  ).toThrow();
  expect(() => responseModel([], "", "missing-provider")).toThrow();
});
