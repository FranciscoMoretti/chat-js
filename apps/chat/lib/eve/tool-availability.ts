import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { toolAvailability } from "@/tools/chatjs/tool-availability";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolAvailability); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type ToolAvailability = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) => boolean;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (installedToolAvailabilityMiddleware); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers -- * no-magic-numbers (#517): installedToolAvailabilityMiddleware uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
export const installedToolAvailabilityMiddleware = (
  session: Parameters<ToolAvailability>[0]
): LanguageModelMiddleware => {
  const unavailable = new Set(
    Object.entries(toolAvailability).flatMap(
      ([name, available]: readonly [string, ToolAvailability]) => {
        if (available(session)) {
          return [];
        }
        return [name];
      }
    )
  );
  return {
    specificationVersion: "v4",
    // oxlint-disable-next-line typescript/promise-function-async -- Filtering runs synchronously before Promise.resolve; async would turn filter/getter failures into rejections.
    transformParams: (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Return the native LanguageModelMiddleware call options after filtering tools; nested readonly prompt/provider arrays are rejected by the SDK result contract.
      {
        params,
      }
    ) =>
      Promise.resolve({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing params own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...params,
        // oxlint-disable-next-line oxc/no-optional-chaining -- AI middleware params.tools is an optional capability list; omit/filter only when supplied, preserving the undefined tools result and synchronous filter failures. The app guidance prefers optional chaining.
        tools: params.tools?.filter(
          (tool: { readonly name: string }) => !unavailable.has(tool.name)
        ),
      }),
  };
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable no-magic-numbers */
