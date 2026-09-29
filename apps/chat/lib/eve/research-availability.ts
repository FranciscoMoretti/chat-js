import type { LanguageModelMiddleware } from "ai";
import type { ToolContext } from "eve/tools";

import { tools } from "../../tools/chatjs/tools";
import { config } from "../config";
import { eveToolAllowed, eveTurnTool } from "./turn-tools";

export const researchAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) => {
  const owner = session.auth.initiator;
  const selected = eveTurnTool.get();
  return Boolean(
    owner &&
    !session.parent &&
    owner.attributes.chatjsGuest !== "true" &&
    eveToolAllowed("deepResearch") &&
    (!selected || selected === "deepResearch") &&
    config.ai.tools.deepResearch.enabled &&
    config.ai.tools.documents.enabled &&
    config.ai.tools.documents.types.text &&
    Object.hasOwn(tools, "webSearch")
  );
};

// EVE workflow tools are static; filter their model exposure while keeping the execution guard.
export const researchAvailabilityMiddleware = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): LanguageModelMiddleware => {
  const available = researchAvailable(session);
  return {
    specificationVersion: "v4",
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        tools: params.tools?.filter(
          (tool) => available || tool.name !== "deepResearch"
        ),
      }),
  };
};
