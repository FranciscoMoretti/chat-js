import type { EveMessagePart } from "eve/client";
/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-mcp-result"; "../components/part/mcp-tool-result" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import React from "react";
import { createRoot } from "react-dom/client";

import { EveMcpResult } from "../components/eve/eve-mcp-result";
import { McpToolResult } from "../components/part/mcp-tool-result";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const common = {
  input: { text: "Hello MCP" },
  toolCallId: "echo",
  toolName: "local__echo",
  type: "dynamic-tool",
} as const;
/* oxlint-disable no-magic-numbers, oxc/no-rest-spread-properties, unicorn/no-null --
 * no-magic-numbers (#517): parts uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-rest-spread-properties (#543): parts copies or separates ...common while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): parts preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, inputText: "", state: "input-streaming" },
  { ...common, state: "input-available" },
  {
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "text", value: "Hello MCP" },
      output: { text: "Hello MCP" },
    },
    state: "output-available",
  },
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Each output case needs an independent copy of the shared tool-result fixture.
  ...[false, 0, true, null, ""].map((output, index) => ({
    ...common,
    output: {
      kind: "chatjs.mcp-result",
      modelOutput: { type: "json", value: output },
      output,
    },
    state: "output-available" as const,
    toolCallId: `value-${index}`,
    toolName: `local__value_${index}`,
  })),
  { ...common, errorText: "private connector URL", state: "output-error" },
  {
    ...common,
    approval: { approved: false, id: "fixture" },
    state: "output-denied",
  },
  { ...common, output: { invalid: true }, state: "output-available" },
];
/* oxlint-enable no-magic-numbers, oxc/no-rest-spread-properties, unicorn/no-null */
const root = document.querySelector("#fixture");
if (!root) {
  throw new Error("Missing fixture root");
}
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, unicorn/no-null --
 * no-magic-numbers (#517): createRoot(root).render uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * react-perf/jsx-no-new-object-as-prop (#558): createRoot(root).render creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * unicorn/no-null (#570): createRoot(root).render preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
createRoot(root).render(
  <main className="mx-auto max-w-3xl space-y-6 p-6">
    <section className="space-y-6" id="native-mcp">
      {parts.map((part) => (
        <EveMcpResult defaultOpen key={JSON.stringify(part)} part={part} />
      ))}
    </section>
    <section className="space-y-6" id="legacy-mcp">
      {[false, 0, true, null, ""].map((output, index) => (
        <McpToolResult
          defaultOpen
          key={JSON.stringify(output)}
          part={{
            input: {},
            output,
            state: "output-available",
            toolName: `local__value_${index}`,
          }}
        />
      ))}
    </section>
  </main>
);
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, unicorn/no-null */
