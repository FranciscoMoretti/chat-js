import { describe, expect, it } from "vitest";

import { getEnabledFeatures } from "./features-config";

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): describe("getEnabledFeatures") accepts { key }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
describe("getEnabledFeatures", () => {
  it("preserves the feature selector order", () => {
    expect(getEnabledFeatures().map(({ key }) => key)).toEqual([
      "reasoning",
      "functionCalling",
      "imageInput",
      "pdfInput",
    ]);
  });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
