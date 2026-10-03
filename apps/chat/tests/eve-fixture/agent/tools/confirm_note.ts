/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../../../lib/eve/turn-tools" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */

import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { filterEveTools } from "../../../../lib/eve/turn-tools";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * no-magic-numbers (#517): confirmNote uses 1, 500 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): confirmNote derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): confirmNote handles optional session.initiator?.principalId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): confirmNote accepts { responder, session }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): confirmNote preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const confirmNote = defineTool({
  approval: {
    request: always(),
    response: ({ responder, session }) =>
      responder.principalId === session.initiator?.principalId
        ? { status: "allowed" }
        : { reason: "Only the owner may respond", status: "rejected" },
  },
  description:
    "Confirm a short note after explicit human approval. No external side effects.",
  execute: ({ note }) => Promise.resolve({ confirmed: true, note }),
  inputSchema: z.object({ note: z.string().trim().min(1).max(500) }),
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default defineDynamic({
  events: {
    "step.started": () => filterEveTools({ confirm_note: confirmNote }),
  },
});
/* oxlint-enable import/no-default-export */
