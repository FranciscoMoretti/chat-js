import { defineState } from "eve/context";
import { defineDynamic } from "eve/tools";

import { isAccountSession } from "@/lib/eve/session-identity";
import { providers } from "@/chatjs/generated/providers";

const MAX_RESEARCH_SEARCH_ROUNDS = 19;
const INITIAL_SEARCH_ROUND = 0;
const SEARCH_ROUND_INCREMENT = 1;

type ResearchSearchContext = Readonly<{
  session: Readonly<{
    auth: Readonly<{
      initiator: Readonly<{
        authenticator?: string;
      }> | null;
    }>;
  }>;
}>;

const researchSteps = defineState<number>(
  "chatjs.research-steps",
  () => INITIAL_SEARCH_ROUND
);

const requireResearchSearch =
  (): (typeof providers)[keyof typeof providers] => {
    const providerEntry = Object.entries(providers).find(
      ([name]: Readonly<[string, unknown]>) => name === "webSearch"
    );
    const [, search] = providerEntry ?? [];
    if (!search) {
      throw new Error("Deep research requires an installed webSearch tool.");
    }
    return search;
  };

export default defineDynamic({
  events: {
    "step.started": (_event, context: ResearchSearchContext) => {
      if (!isAccountSession(context.session)) {
        throw new Error("Research search is unavailable.");
      }
      const search = requireResearchSearch();
      // The old SDK researcher allowed twenty model steps. Reserve the last
      // response for findings, without enabling another search round.
      const searchRounds = researchSteps.get();
      researchSteps.update((count) => count + SEARCH_ROUND_INCREMENT);

      if (searchRounds >= MAX_RESEARCH_SEARCH_ROUNDS) {
        return null;
      }
      return search;
    },
  },
});
