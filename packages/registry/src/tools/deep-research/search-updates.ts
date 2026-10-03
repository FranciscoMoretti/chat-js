/* oxlint-disable eslint/func-style -- EVE compiles durable step declarations. */
import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";

import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { toolOutputSchema } from "@/lib/eve/tool-result";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export async function researchSearchUpdates(context: WorkflowToolContext) {
  "use step";
  const owner = context.session.auth.initiator;
  if (!owner) {
    throw new Error("Research progress requires an authenticated owner.");
  }
  const client = new Client(getEveConnectionOptions(owner.principalId));
  const options = { signal: context.abortSignal };
  const root = await client.sessions
    .attach(context.session.id)
    .snapshot(options);
  const children = root.events.flatMap((event) =>
    event.type === "subagent.called" &&
    !event.data.remote &&
    event.data.name === "researcher" &&
    event.data.turnId === context.session.turn.id &&
    // EVE prefixes workflow agent invocation IDs with their owning tool call ID.
    event.data.callId.startsWith(`${context.callId}:`)
      ? [event.data.childSessionId]
      : []
  );
  const snapshots = await Promise.all(
    children.map((sessionId) =>
      client.sessions.attach(sessionId).snapshot(options)
    )
  );
  return snapshots.flatMap((snapshot) =>
    snapshot.events.flatMap((event) => {
      if (
        event.type !== "action.result" ||
        event.data.result.kind !== "tool-result"
      ) {
        return [];
      }
      const receipt = toolOutputSchema.safeParse(event.data.result.output);
      if (!receipt.success) {
        return [];
      }
      return (receipt.data.updates ?? []).flatMap((value) => {
        const update = ResearchUpdateSchema.safeParse(value);
        return update.success && update.data.type === "web"
          ? [update.data]
          : [];
      });
    })
  );
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
