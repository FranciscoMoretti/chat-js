/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { AiGatewayModel } from "@chat-js/gateways/models";
import { expect, test } from "vitest";

import { toModelData } from "./to-model-data";
/* oxlint-enable sort-imports */

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

/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): test("missing positive tool tags remain unknown instead of declaring no support") copies or separates ...model while preserving existing object ownership; mutating source objects is not equivalent.
 */
test("missing positive tool tags remain unknown instead of declaring no support", () => {
  expect(toModelData(model).toolCall).toBeUndefined();
  expect(toModelData({ ...model, tags: ["vision"] }).toolCall).toBeUndefined();
  expect(toModelData({ ...model, tags: ["tool-use"] }).toolCall).toBe(true);
  expect(toModelData({ ...model, type: "image" }).toolCall).toBe(false);
});
/* oxlint-enable oxc/no-rest-spread-properties */
