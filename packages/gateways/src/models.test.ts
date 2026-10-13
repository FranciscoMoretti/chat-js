import { describe, expect, expectTypeOf, it } from "vitest";

import type { AiGatewayModel } from "./models";
import { aiGatewayModelSchema } from "./models";

const tagsSchema = aiGatewayModelSchema.shape.tags;

describe("gateway model tags", () => {
  it("accepts known and future provider tags without changing their values", () => {
    const tags: NonNullable<AiGatewayModel["tags"]> = [
      "reasoning",
      "tool-use",
      "vision",
      "file-input",
      "image-generation",
      "implicit-caching",
      "future-provider-tag",
      "",
    ];

    expect(tagsSchema.parse(tags)).toEqual(tags);
    expectTypeOf<string>().toExtend<
      NonNullable<AiGatewayModel["tags"]>[number]
    >();
    expectTypeOf(tagsSchema.parse(tags)).toExtend<string[] | undefined>();
  });

  it("keeps tags optional and accepts an empty list", () => {
    expect(aiGatewayModelSchema.pick({ tags: true }).parse({})).toEqual({});
    expect(tagsSchema.parse([])).toEqual([]);
  });

  it.each([{ tag: true }, { tag: {} }, { tag: [] }])(
    "rejects non-string tags: $tag",
    ({ tag }: { readonly tag: unknown }) => {
      expect(tagsSchema.safeParse([tag]).success).toBe(false);
    }
  );
});
