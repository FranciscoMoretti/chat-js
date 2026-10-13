import { eveTurnGuest, eveTurnTool } from "../../lib/eve/turn-tools";
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
      eveTurnGuest.update(
        () => context.session.auth.current?.attributes.chatjsGuest === "true"
      );
      const supplied = context.session.auth.current?.attributes.selectedTool;
      const selected =
        supplied === undefined ? null : frontendToolsSchema.parse(supplied);
      eveTurnTool.update(() => selected);
    },
  },
});
