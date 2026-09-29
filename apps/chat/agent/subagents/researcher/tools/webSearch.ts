import { defineState } from "eve/context";
import { defineDynamic } from "eve/tools";

import { tools } from "../../../../tools/chatjs/tools";

const researchSteps = defineState<number>("chatjs.research-steps", () => 0);

export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      if (context.session.auth.initiator?.attributes.chatjsGuest === "true") {
        throw new Error("Research search is unavailable.");
      }
      const search = Object.entries(tools).find(
        ([name]) => name === "webSearch"
      )?.[1];
      if (!search) {
        throw new Error("Deep research requires an installed webSearch tool.");
      }
      // The old SDK researcher allowed twenty model steps. Reserve the last
      // response for findings, without enabling another search round.
      const searchRounds = researchSteps.get();
      researchSteps.update((count) => count + 1);
      return searchRounds >= 19 ? null : search;
    },
  },
});
