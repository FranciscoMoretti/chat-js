import { isAccountSession } from "@/lib/eve/session-identity";
import type { ToolContext } from "eve/tools";

import { installedDocumentKinds } from "@/integrations/tools/catalog";

const EMPTY_DOCUMENT_KIND_COUNT = 0;

export const deleteDocumentAvailable = (
  session: Pick<ToolContext["session"], "auth" | "parent">
): boolean =>
  isAccountSession(session) &&
  !session.parent &&
  installedDocumentKinds.size > EMPTY_DOCUMENT_KIND_COUNT;
