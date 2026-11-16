import React from "react";
import { expect, test } from "vitest";
import { Plugins } from "@/chatjs/core/ui/slots";
import { imageViewerClient } from "../../plugins/image-viewer/src/client-plugin";
import { captureChatStory } from "../_shared/visual";
import { PublishFileRenderer } from "./renderer";

test("publish-file renders lifecycle and optional viewer states", async () => {
  const common = { isReadonly: true, messageId: "file-message" };
  const input = { path: "/workspace/report.xlsx" };
  const output = {
    fileId: "file",
    name: "report.xlsx",
    size: 24_576,
    mediaType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    url: "data:application/octet-stream;base64,cmVwb3J0",
  };
  await captureChatStory("publish-file", [
    {
      label: "Preparing",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{ toolCallId: "streaming", state: "input-streaming" }}
        />
      ),
    },
    {
      label: "Publishing",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{ toolCallId: "publishing", state: "input-available", input }}
        />
      ),
    },
    {
      label: "Awaiting approval",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{ toolCallId: "approval", state: "approval-requested", input }}
        />
      ),
    },
    {
      label: "Denied",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{ toolCallId: "denied", state: "output-denied", input }}
        />
      ),
    },
    {
      label: "Failed",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{
            toolCallId: "failed",
            state: "output-error",
            input,
            errorText: "The sandbox file is no longer available.",
          }}
        />
      ),
    },
    {
      label: "Download without a viewer",
      ui: (
        <PublishFileRenderer
          {...common}
          tool={{
            toolCallId: "published",
            state: "output-available",
            input,
            output,
          }}
        />
      ),
      settle: (section) => {
        expect(
          section.querySelector('[aria-label="Download report.xlsx"]')
        ).not.toBeNull();
        expect(section.querySelector('[aria-label^="Open"]')).toBeNull();
      },
    },
    {
      label: "Image with an optional viewer",
      ui: (
        <Plugins plugins={[imageViewerClient]}>
          <PublishFileRenderer
            {...common}
            tool={{
              toolCallId: "image",
              state: "output-available",
              input,
              output: { ...output, name: "chart.png", mediaType: "image/png" },
            }}
          />
        </Plugins>
      ),
      settle: (section) => {
        expect(
          section.querySelector('[aria-label="Open image"]')
        ).not.toBeNull();
        expect(
          section.querySelector('[aria-label="Download chart.png"]')
        ).not.toBeNull();
      },
    },
  ]);
});
