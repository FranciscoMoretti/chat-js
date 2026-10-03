import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { toolAvailability } from "@/tools/chatjs/tool-availability";

export type ToolAvailability = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) => boolean;

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/no-named-export (#527): Preserve the named installedToolAvailabilityMiddleware API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): installedToolAvailabilityMiddleware uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): installedToolAvailabilityMiddleware derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): installedToolAvailabilityMiddleware handles optional params.tools?.filter((tool) => !unavailable.has(tool.name)) without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): installedToolAvailabilityMiddleware copies or separates ...params while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): installedToolAvailabilityMiddleware accepts [name, available]; { params }; tool; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): installedToolAvailabilityMiddleware preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export const installedToolAvailabilityMiddleware = (
  session: Parameters<ToolAvailability>[0]
): LanguageModelMiddleware => {
  const unavailable = new Set(
    Object.entries(toolAvailability).flatMap(([name, available]) =>
      available(session) ? [] : [name]
    )
  );
  return {
    specificationVersion: "v4",
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        tools: params.tools?.filter((tool) => !unavailable.has(tool.name)),
      }),
  };
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
