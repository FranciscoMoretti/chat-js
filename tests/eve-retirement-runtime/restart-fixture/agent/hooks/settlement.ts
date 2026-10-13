import { defineHook } from "eve/hooks";

import { barrier } from "../../control";

export default defineHook({
  events: {
    "approval.settled": async (event) => {
      await barrier("settled", event);
    },
  },
});
