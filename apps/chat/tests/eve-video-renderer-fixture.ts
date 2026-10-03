/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-tool-result"; "../lib/eve/tool-result" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createToolResult } from "../lib/eve/tool-result";
/* oxlint-enable import/no-relative-parent-imports */

const imageMode = process.argv.includes("--image");
const common = {
  input: { prompt: "A tree in the wind" },
  toolCallId: "fixture",
  toolName: imageMode ? "generateImage" : "generateVideo",
  type: "dynamic-tool",
} as const;
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): parts uses 0.5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): parts derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-rest-spread-properties (#543): parts copies or separates ...common; ...(imageMode ? { fileId: "abcdefghijklmnopqrstuvwx.png", imag while preserving existing object ownership; mutating source objects is not equivalent.
 */
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, inputText: "", state: "input-streaming" },
  { ...common, state: "input-available" },
  {
    ...common,
    output: createToolResult(
      {
        ...(imageMode
          ? {
              fileId: "abcdefghijklmnopqrstuvwx.png",
              imageUrl: "/api/files/abcdefghijklmnopqrstuvwx.png",
            }
          : {
              fileId: "abcdefghijklmnopqrstuvwx.mp4",
              videoUrl: "/api/files/abcdefghijklmnopqrstuvwx.mp4",
            }),
        prompt: common.input.prompt,
      },
      0.5
    ),
    state: "output-available",
  },
  {
    ...common,
    errorText: imageMode
      ? "Image provider unavailable"
      : "Video provider unavailable",
    state: "output-error",
  },
  {
    ...common,
    approval: { approved: false, id: "fixture" },
    state: "output-denied",
  },
  {
    ...common,
    output: createToolResult(
      { error: "Upload failed after provider work completed." },
      0.5
    ),
    state: "output-available",
  },
  { ...common, output: { invalid: true }, state: "output-available" },
];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): process.stdout.write keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
process.stdout.write(
  renderToStaticMarkup(
    createElement(
      "main",
      { className: "mx-auto max-w-3xl space-y-6 p-6" },
      parts.map((part, index) =>
        createElement(
          "section",
          { key: index },
          createElement(EveToolResult, {
            isReadonly: true,
            messageId: "fixture",
            part,
          })
        )
      )
    )
  )
);
/* oxlint-enable unicorn/max-nested-calls */
