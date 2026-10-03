import { defineState } from "eve/context";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { defineDynamic } from "eve/tools";
/* oxlint-enable eslint/sort-imports */

import { providers } from "@/tools/chatjs/providers";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchSteps = defineState<number>("chatjs.research-steps", () => 0);
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      if (context.session.auth.initiator?.attributes.chatjsGuest === "true") {
        throw new Error("Research search is unavailable.");
      }
      const search = Object.entries(providers).find(
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable import/no-default-export */
