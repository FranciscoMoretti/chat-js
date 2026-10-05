import type { ToolContext } from "eve/tools";

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

const EMPTY_DOCUMENT_KIND_COUNT = 0;

export const deleteDocumentAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): boolean =>
  Boolean(
    session.auth.initiator &&
    session.auth.initiator.attributes.chatjsGuest !== "true" &&
    !session.parent &&
    installedDocumentKinds.size > EMPTY_DOCUMENT_KIND_COUNT
  );
