import type { ToolContext } from "eve/tools";

import { config } from "@/lib/config";

export const deleteDocumentAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
) =>
  Boolean(
    session.auth.initiator &&
    session.auth.initiator.attributes.chatjsGuest !== "true" &&
    !session.parent &&
    config.ai.tools.documents.enabled &&
    Object.values(config.ai.tools.documents.types).some(Boolean)
  );
