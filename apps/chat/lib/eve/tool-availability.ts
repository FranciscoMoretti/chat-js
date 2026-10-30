import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { toolAvailability } from "@/chatjs/generated/tool-availability";

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
    // oxlint-disable-next-line typescript/promise-function-async -- AI SDK transformParams requires PromiseLike params, but filtering available tools is synchronous; eslint/require-await rejects an immediate async result. No I/O is needed here.
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        tools: params.tools?.filter(
          (tool: { readonly name: string }) => !unavailable.has(tool.name)
        ),
      }),
  };
};
