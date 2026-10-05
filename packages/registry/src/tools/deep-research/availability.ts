import type { ToolContext } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { eveToolAllowed, eveTurnTool } from "@/lib/eve/turn-tools";
/* oxlint-enable sort-imports */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
import { providers } from "@/tools/chatjs/providers";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (researchAvailable); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
