import type { ToolContext } from "eve/tools";

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

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
