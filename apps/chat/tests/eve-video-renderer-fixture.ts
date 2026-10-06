/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-tool-result"; "../lib/eve/tool-result" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveToolResult } from "../components/eve/eve-tool-result";
/* oxlint-enable sort-imports */
import { createToolResult } from "../lib/eve/tool-result";
/* oxlint-enable import/no-relative-parent-imports */

const imageMode = process.argv.includes("--image");
const common = {
  input: { prompt: "A tree in the wind" },
  toolCallId: "fixture",
  // oxlint-disable-next-line no-ternary -- Keep toolName as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  toolName: imageMode ? "generateImage" : "generateVideo",
  type: "dynamic-tool",
} as const;
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): parts uses 0.5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  { ...common, inputText: "", state: "input-streaming" },
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  { ...common, state: "input-available" },
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    output: createToolResult(
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (imageMode           ? {               fileId: "abcdefghijklmnopqrstuvwx.png",               imageUrl: "/api/files/abcdefghijklmnopqrstuvwx.png",             }           : {               fileId: "abcdefghijklmnopqrstuvwx.mp4",               videoUrl: "/api/files/abcdefghijklmnopqrstuvwx.mp4",             }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...common,
    // oxlint-disable-next-line no-ternary -- Keep errorText as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    errorText: imageMode
      ? "Image provider unavailable"
      : "Video provider unavailable",
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
    output: createToolResult(
      { error: "Upload failed after provider work completed." },
      0.5
    ),
    state: "output-available",
  },
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing common own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
