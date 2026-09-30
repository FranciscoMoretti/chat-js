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
