import { assertToolConfigured } from "../../lib/eve/tool-configuration";
import { isAccountSession } from "../../lib/eve/session-identity";
import { eveTurnAccount, eveTurnTool } from "../../lib/eve/turn-tools";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { frontendToolsSchema } from "../../lib/ai/types";

export default defineHook({
  events: {
    "turn.started": (
      _event: unknown,
      context: Readonly<{
        session: Readonly<Pick<HookContext["session"], "auth">>;
      }>
    ) => {
      eveTurnAccount.update(() => isAccountSession(context.session));
      const supplied = isAccountSession(context.session)
        ? context.session.auth.current?.attributes.selectedTool
        : undefined;
      const selected =
        supplied === undefined ? null : frontendToolsSchema.parse(supplied);
      if (selected !== null && isAccountSession(context.session)) {
        assertToolConfigured(selected);
      }
      eveTurnTool.update(() => selected);
    },
  },
});
