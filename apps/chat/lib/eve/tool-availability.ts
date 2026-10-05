import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { toolAvailability } from "@/tools/chatjs/tool-availability";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolAvailability); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type ToolAvailability = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) => boolean;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (installedToolAvailabilityMiddleware); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): installedToolAvailabilityMiddleware uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): installedToolAvailabilityMiddleware accepts [name, available]; { params }; tool; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
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
    // oxlint-disable-next-line typescript/promise-function-async -- Filtering runs synchronously before Promise.resolve; async would turn filter/getter failures into rejections.
    transformParams: ({ params }) =>
      Promise.resolve({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing params own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...params,
        tools: params.tools?.filter((tool) => !unavailable.has(tool.name)),
      }),
  };
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
