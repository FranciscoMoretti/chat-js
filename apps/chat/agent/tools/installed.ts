import { missingToolConfiguration } from "../../lib/eve/tool-configuration";
import type { DynamicContext } from "eve";
import type { SessionProfile } from "../../chatjs/core/session/contracts";
import { isAccountSession } from "../../lib/eve/session-identity";
import { defineDynamic } from "eve/tools";

import { eveImageContext } from "../../lib/eve/image-context";
import { eveToolImageContext } from "../../lib/eve/tool-image-context";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../integrations/tools/execution";

export default defineDynamic(async (context: DynamicContext) => {
  if (!isAccountSession(context.session)) {
    let profile: SessionProfile | undefined;
    if (
      context.session.auth.initiator?.authenticator?.startsWith("chatjs-") ===
      true
    ) {
      const { findSessionProfile } =
        await import("../../lib/eve/session-profile");
      profile = findSessionProfile(context.session);
    }

    return Object.fromEntries(
      Object.entries(tools).filter(
        ([name]) =>
          (profile?.toolNames === undefined || profile.toolNames.has(name)) &&
          missingToolConfiguration(name).length === 0
      )
    );
  }
  const images = eveImageContext(await context.messages());
  eveToolImageContext.update(() => images);
  return filterEveTools(tools);
});
