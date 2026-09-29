import type { ToolContext } from "eve/tools";

import { config } from "@/lib/config";
import { eveToolAllowed, eveTurnTool } from "@/lib/eve/turn-tools";
import { providers } from "@/tools/chatjs/providers";

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
    Object.hasOwn(providers, "webSearch")
  );
};
