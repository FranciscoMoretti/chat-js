import { defineHook } from "eve/hooks";

/* oxlint-disable import/no-relative-parent-imports -- The fixture shares its barrier helpers inside the isolated app root. */
import { barrier } from "../../control";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- EVE supplies compiled callback contexts; the fixture reads their SDK-owned mutable types. */
// oxlint-disable-next-line import/no-default-export -- EVE discovers authored hooks through their default exports.
export default defineHook({
  events: {
    "approval.settled": async (event) => {
      await barrier("settled", event);
    },
  },
});

/* oxlint-enable typescript/prefer-readonly-parameter-types */
