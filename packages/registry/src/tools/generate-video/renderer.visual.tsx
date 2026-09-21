import { act } from "react";
import { expect, test } from "vitest";

import { assetDataUri, captureChatStory } from "../_shared/visual";
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
      label: "Generating (skeleton)",
      ui: (
        <GenerateVideoRenderer
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
        await act(() => {
          video.pause();
          video.currentTime = 0;
        });
        await expect.poll(() => video.seeking).toBe(false);
      },
      ui: (
        <GenerateVideoRenderer
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
