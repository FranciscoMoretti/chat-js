import { describe, expect, it } from "vitest";

import { getEnabledFeatures } from "./features-config";

describe("getEnabledFeatures", () => {
  it("preserves the feature selector order", () => {
    expect(
      getEnabledFeatures().map(
        ({
          key,
        }: Readonly<
          Pick<ReturnType<typeof getEnabledFeatures>[number], "key">
        >) => key
      )
    ).toEqual(["reasoning", "functionCalling", "imageInput", "pdfInput"]);
  });
});
