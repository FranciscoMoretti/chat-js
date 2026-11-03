import { runs } from "eve/events";
import { defineDynamic } from "eve/tools";

import { isAccountSession } from "@/lib/eve/session-identity";
import { toolProviders } from "@/integrations/tools/providers";

const MAX_RESEARCH_SEARCH_ROUNDS = 19;

const requireResearchSearch =
  (): (typeof toolProviders)[keyof typeof toolProviders] => {
    const providerEntry = Object.entries(toolProviders).find(
      ([name]: Readonly<[string, unknown]>) => name === "webSearch"
    );
    const [, search] = providerEntry ?? [];
    if (!search) {
      throw new Error("Deep research requires an installed webSearch tool.");
    }
    return search;
  };

export default defineDynamic((context) => {
  if (!isAccountSession(context.session)) {
    throw new Error("Research search is unavailable.");
  }
  const search = requireResearchSearch();
  // The old SDK researcher allowed twenty model steps. Reserve the last
  // response for findings, without enabling another search round.
  const searchRounds = runs(context.view, { turnId: context.turn?.id }).filter(
    (run) => run.status === "settled"
  ).length;

  if (searchRounds >= MAX_RESEARCH_SEARCH_ROUNDS) {
    return null;
  }
  return search;
});
