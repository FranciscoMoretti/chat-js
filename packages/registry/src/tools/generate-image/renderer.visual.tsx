import React from "react";
import { expect, test } from "vitest";

import { Plugins } from "@/chatjs/core/ui/slots";
import { imageViewerClient } from "../../plugins/image-viewer/src/client-plugin";
import { captureChatStory, makeCanvasDataUri } from "../_shared/visual";
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

test("generate-image renders every state in the chat", async () => {
  await captureChatStory("generate-image", [
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
      label: "Generated without viewer",
      settle: async (section) => {
        const img = section.querySelector("img");
        if (!img) {
          throw new Error("generated image missing");
        }
        await expect.poll(() => img.complete).toBe(true);
        await img.decode();
        expect(section.querySelector('[aria-label="Open image"]')).toBeNull();
        expect(
          section.querySelector('[title="Download image"]')
        ).not.toBeNull();
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
      label: "Generated with optional viewer",
      settle: async (section) => {
        await expect
          .poll(() => section.querySelector('[aria-label="Open image"]'))
          .not.toBeNull();
        await section.querySelector("img")?.decode();
      },
      ui: (
        <Plugins plugins={[imageViewerClient]}>
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
        </Plugins>
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
  ]);
});
