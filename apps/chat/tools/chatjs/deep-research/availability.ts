import { isAccountSession } from "@/lib/eve/session-identity";
import { eveTurnAccount, eveTurnTool } from "@/lib/eve/turn-tools";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/integrations/tool-catalog";
import type { ToolContext } from "eve/tools";
import { toolProviders } from "@/integrations/tool-providers";

export const researchAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): boolean => {
  const selected = eveTurnTool.get();
  return (
    isAccountSession(session) &&
    !session.parent &&
    eveTurnAccount.get() &&
    (!selected || selected === "deepResearch") &&
    installedToolNames.has("deepResearch") &&
    installedDocumentKinds.has("text") &&
    Object.hasOwn(toolProviders, "webSearch")
  );
};
