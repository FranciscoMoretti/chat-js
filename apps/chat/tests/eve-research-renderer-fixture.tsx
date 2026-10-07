/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-tool-result"; "../hooks/use-artifact"; "../lib/eve/tool-result" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */

import type { EveMessagePart } from "eve/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveToolResult } from "../components/eve/eve-tool-result";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ArtifactProvider } from "../hooks/use-artifact";
/* oxlint-enable sort-imports */
import { createToolResult } from "../lib/eve/tool-result";
/* oxlint-enable import/no-relative-parent-imports */

const common = {
  input: {},
  toolCallId: "research",
  toolName: "deepResearch",
  type: "dynamic-tool",
} as const;
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): parts uses 0, 0.5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  { ...common, inputText: "", state: "input-streaming" },
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  { ...common, state: "input-available" },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    output: createToolResult({ searches: [] }, 0, [
      {
        type: "started",
        title: "Research started",
        timestamp: 0,
        toolCallId: "research",
      },
    ]),
    state: "output-available",
  },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    output: createToolResult(
      {
        format: "clarifying_questions",
        answer: "Which time period should the research cover?",
      },
      0
    ),
    state: "output-available",
  },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    output: createToolResult(
      {
        format: "report",
        status: "success",
        result: "Saved",
        documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
        revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
        title: "Research report",
        kind: "text",
        date: "2026-09-10",
      },
      0.5
    ),
    state: "output-available",
  },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    errorText: "Research provider unavailable",
    state: "output-error",
  },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    approval: { approved: false, id: "fixture" },
    state: "output-denied",
  },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    output: createToolResult({ error: "Report could not be saved." }, 0.5),
    state: "output-available",
  },
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  { ...common, output: { invalid: true }, state: "output-available" },
];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable react/jsx-max-depth --
 * react/jsx-max-depth (#548): process.stdout.write keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 */
process.stdout.write(
  renderToStaticMarkup(
    <ArtifactProvider>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {parts.map((part) => (
          <section key={JSON.stringify(part)}>
            <EveToolResult isReadonly messageId="fixture" part={part} />
          </section>
        ))}
      </main>
    </ArtifactProvider>
  )
);
/* oxlint-enable react/jsx-max-depth */
