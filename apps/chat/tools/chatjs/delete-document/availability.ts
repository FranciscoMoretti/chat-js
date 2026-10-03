import type { ToolContext } from "eve/tools";

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const deleteDocumentAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): boolean =>
  Boolean(
    session.auth.initiator &&
    session.auth.initiator.attributes.chatjsGuest !== "true" &&
    !session.parent &&
    installedDocumentKinds.size > 0
  );
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
