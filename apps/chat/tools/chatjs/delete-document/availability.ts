import type { ToolContext } from "eve/tools";

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

export const deleteDocumentAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) =>
  Boolean(
    session.auth.initiator &&
    session.auth.initiator.attributes.chatjsGuest !== "true" &&
    !session.parent &&
    installedDocumentKinds.size > 0
  );
