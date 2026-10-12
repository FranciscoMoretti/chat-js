import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { toolAvailability } from "@/tools/chatjs/tool-availability";

export type ToolAvailability = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) => boolean;

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
    // oxlint-disable-next-line typescript/promise-function-async -- Filtering is synchronous before Promise.resolve; async would turn filter/getter throws into rejections and has no real work to await.
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        tools: params.tools?.filter(
          (tool: { readonly name: string }) => !unavailable.has(tool.name)
        ),
      }),
  };
};
