import { expect, test } from "vitest";
import type { AiGatewayModel } from "@chat-js/gateways/models";

import { toModelData } from "./to-model-data";

const model: AiGatewayModel = {
  context_window: 128_000,
  created: 0,
  description: "A model without exhaustive capability metadata",
  id: "fixture/model",
  max_tokens: 8192,
  name: "Fixture",
  object: "model",
  owned_by: "fixture",
  pricing: {},
  type: "language",
};

test("missing positive tool tags remain unknown instead of declaring no support", () => {
  expect(toModelData(model).toolCall).toBeUndefined();
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  expect(toModelData({ ...model, tags: ["vision"] }).toolCall).toBeUndefined();
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  expect(toModelData({ ...model, tags: ["tool-use"] }).toolCall).toBe(true);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  expect(toModelData({ ...model, type: "image" }).toolCall).toBe(false);
});
