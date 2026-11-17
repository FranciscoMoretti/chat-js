import { expectTypeOf, test } from "vitest";
import type { NativeToolUI } from "./tool-types";
import type research from "@/agent/tools/deepResearch";

test("native workflow outputs retain the file report and clarification contracts", () => {
  type Research = NativeToolUI<typeof research>;
  expectTypeOf<
    Extract<Research["output"], { format: "report" }>["path"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    Extract<Research["output"], { format: "clarifying_questions" }>["answer"]
  >().toEqualTypeOf<string>();
});
