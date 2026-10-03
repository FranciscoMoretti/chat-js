/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import React from "react";
import { expect, test } from "vitest";

import { captureChatStory, flush, makeCanvasDataUri } from "../_shared/visual";
import { GenerateImageRenderer } from "./renderer";

const prompt = "A blue-to-purple gradient sky";

// A canvas data URI travels inside the archive and replays intact (a runtime
// bitmap or a blob URL would not).
const imageUrl = makeCanvasDataUri(512, 384, (ctx, width, height) => {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2563eb");
  gradient.addColorStop(1, "#7c3aed");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
});

test("generate-image renders every state in the chat", () =>
  captureChatStory("generate-image", [
    {
      label: "Prompt still streaming",
      ui: (
        <GenerateImageRenderer
          isReadonly
          messageId="image-message"
          tool={{
            state: "input-streaming",
            toolCallId: "generate-image-stream",
          }}
        />
      ),
    },
    {
      label: "Generating (skeleton)",
      ui: (
        <GenerateImageRenderer
          isReadonly
          messageId="image-message"
          tool={{
            input: { prompt },
            state: "input-available",
            toolCallId: "generate-image-input",
          }}
        />
      ),
    },
    {
      label: "Generated",
      settle: async (section) => {
        const img = section.querySelector("img");
        if (!img) {
          throw new Error("generated image missing");
        }
        await expect.poll(() => img.complete).toBe(true);
        await img.decode();
      },
      ui: (
        <GenerateImageRenderer
          isReadonly
          messageId="image-message"
          tool={{
            input: { prompt },
            output: { imageUrl, prompt },
            state: "output-available",
            toolCallId: "generate-image-output",
          }}
        />
      ),
    },
    {
      label: "Generated, actions shown on focus",
      settle: async (section) => {
        const img = section.querySelector("img");
        const button = section.querySelector("button");
        if (!(img && button)) {
          throw new Error("generated image or its button missing");
        }
        await img.decode();
        await flush(() => {
          button.focus();
        });
        const actions = section.querySelector<HTMLElement>(
          String.raw`.group-focus-within\:opacity-100`
        );
        await expect
          .poll(() => actions && getComputedStyle(actions).opacity)
          .toBe("1");
      },
      ui: (
        <GenerateImageRenderer
          isReadonly
          messageId="image-message"
          tool={{
            input: { prompt },
            output: { imageUrl, prompt },
            state: "output-available",
            toolCallId: "generate-image-focused",
          }}
        />
      ),
    },
    {
      label: "Unavailable (load failed)",
      // A malformed image data URI fails to decode, firing the renderer's
      // onError → the "unavailable" fallback. Wait for that swap to land.
      settle: async (section) => {
        await expect
          .poll(() => section.textContent)
          .toContain("Generated image unavailable");
      },
      ui: (
        <GenerateImageRenderer
          isReadonly
          messageId="image-message"
          tool={{
            input: { prompt },
            output: { imageUrl: "data:image/png;base64,Zm9v", prompt },
            state: "output-available",
            toolCallId: "generate-image-unavailable",
          }}
        />
      ),
    },
  ]));
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
