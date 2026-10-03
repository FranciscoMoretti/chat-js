import type { ToolContext } from "eve/tools";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { eveToolAllowed, eveTurnTool } from "@/lib/eve/turn-tools";
/* oxlint-enable eslint/sort-imports */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
import { providers } from "@/tools/chatjs/providers";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
