import { expect, expectTypeOf, test } from "vitest";
import { z } from "zod";
import { mergePluginFields } from "./plugin-fields";

test("independent exported fields retain validation and inferred types", () => {
  const fields = mergePluginFields(
    "creation",
    { projectId: z.uuid().optional() },
    { label: z.string().min(1) }
  );
  const input = z.object(fields);
  expectTypeOf<z.infer<typeof input>>().toEqualTypeOf<{
    projectId?: string;
    label: string;
  }>();
  expect(input.parse({ label: "research" })).toEqual({ label: "research" });
  expect(input.safeParse({ label: "" }).success).toBe(false);
});

test("actual schema collisions fail regardless of descriptor declarations", () => {
  expect(() =>
    mergePluginFields("creation", {}, { operationId: z.string() })
  ).toThrow("reserved plugin creation field");
  expect(() =>
    mergePluginFields("history", {}, { cursor: z.string() })
  ).toThrow("reserved plugin history field");
  expect(() =>
    mergePluginFields("creation", { label: z.string() }, { label: z.number() })
  ).toThrow("Duplicate");
  expect(mergePluginFields("creation", {}, {})).toEqual({});
});
