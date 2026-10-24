import { eveToolAllowed, eveTurnTool } from "@/lib/eve/turn-tools";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/composition/generated/installed-tools";
import type { ToolContext } from "eve/tools";
import { providers } from "@/composition/generated/providers";

export const researchAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): boolean => {
  const owner = session.auth.initiator;
  const selected = eveTurnTool.get();
  return Boolean(
    owner &&
    !session.parent &&
    owner.attributes.chatjsGuest !== "true" &&
    eveToolAllowed("deepResearch") &&
    (!selected || selected === "deepResearch") &&
    installedToolNames.has("deepResearch") &&
    installedDocumentKinds.has("text") &&
    Object.hasOwn(providers, "webSearch")
  );
};
