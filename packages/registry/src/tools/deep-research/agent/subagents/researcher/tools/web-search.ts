import { defineState } from "eve/context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { defineDynamic } from "eve/tools";
/* oxlint-enable sort-imports */

import { providers } from "@/tools/chatjs/providers";

const MAX_RESEARCH_SEARCH_ROUNDS = 19;

// oxlint-disable-next-line eslint/no-magic-numbers -- A new research run starts with zero completed search rounds.
const researchSteps = defineState<number>("chatjs.research-steps", () => 0);

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      if (context.session.auth.initiator?.attributes.chatjsGuest === "true") {
        throw new Error("Research search is unavailable.");
      }
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      const search = Object.entries(providers).find(
        ([name]) => name === "webSearch"
        // oxlint-disable-next-line eslint/no-magic-numbers -- Object.entries stores the provider value at tuple index one.
      )?.[1];
      if (!search) {
        throw new Error("Deep research requires an installed webSearch tool.");
      }
      // The old SDK researcher allowed twenty model steps. Reserve the last
      // response for findings, without enabling another search round.
      const searchRounds = researchSteps.get();
      // oxlint-disable-next-line eslint/no-magic-numbers -- Each started search round increments the counter by one.
      researchSteps.update((count) => count + 1);
      return searchRounds >= MAX_RESEARCH_SEARCH_ROUNDS ? null : search;
    },
  },
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable import/no-default-export */
