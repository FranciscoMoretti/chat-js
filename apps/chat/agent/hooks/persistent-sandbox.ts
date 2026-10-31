import { isAccountSession } from "../../lib/eve/session-identity";
import { defineHook } from "eve/hooks";
import { registerAppSandboxSession } from "../../lib/eve/persistent-sandbox";

export default defineHook({
  events: {
    "session.started": async (_event, context) => {
      if (!isAccountSession(context.session)) {
        return;
      }
      await registerAppSandboxSession(context);
    },
  },
});
