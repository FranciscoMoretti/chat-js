/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */

import React from "react";
import { expect, test } from "vitest";

import { assetDataUri, captureChatStory, flush } from "../_shared/visual";
import { GenerateVideoRenderer } from "./renderer";

const prompt = "A calm blue sky";

test("generate-video renders every state in the chat", async () => {
  // The fixture is served over http during the vitest run, but that URL is dead
  // when the archive replays on the UI Verify server. Inline the mp4 as a
  // `data:` URI so the bytes travel inside the archive and the player has a real
  // video to paint on replay.
  const videoUrl = await assetDataUri(
    new URL("fixtures/blue.mp4", import.meta.url).href,
    "video/mp4"
  );

  await captureChatStory("generate-video", [
    {
      label: "Preparing the prompt",
      ui: (
        <GenerateVideoRenderer
          isReadonly
          messageId="video-message"
          tool={{
            state: "input-streaming",
            toolCallId: "generate-video-streaming",
          }}
        />
      ),
    },
    {
      label: "Generating (skeleton)",
      ui: (
        <GenerateVideoRenderer
          isReadonly
          messageId="video-message"
          tool={{
            input: { prompt },
            state: "input-available",
            toolCallId: "generate-video-input",
          }}
        />
      ),
    },
    {
      label: "Failed",
      ui: (
        <GenerateVideoRenderer
          isReadonly
          messageId="video-message"
          tool={{
            errorText: "The video provider timed out.",
            input: { prompt },
            state: "output-error",
            toolCallId: "generate-video-error",
          }}
        />
      ),
    },
    {
      label: "Generated",
      // Wait until the first frame is decodable, then pin to frame 0 so the
      // captured (and replayed) poster is deterministic.
      settle: async (section) => {
        const video = section.querySelector("video");
        if (!video) {
          throw new Error("video player missing");
        }
        await expect.poll(() => video.readyState).toBeGreaterThanOrEqual(2);
        await flush(() => {
          video.pause();
          video.currentTime = 0;
        });
        await expect.poll(() => video.seeking).toBe(false);
      },
      ui: (
        <GenerateVideoRenderer
          isReadonly
          messageId="video-message"
          tool={{
            input: { prompt },
            output: { prompt, videoUrl },
            state: "output-available",
            toolCallId: "generate-video-output",
          }}
        />
      ),
    },
  ]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
