import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createEvePlatformResult } from "../lib/eve/platform-result";

const imageMode = process.argv.includes("--image");
const common = {
  input: { prompt: "A tree in the wind" },
  toolCallId: "fixture",
  toolName: imageMode ? "generateImage" : "generateVideo",
  type: "dynamic-tool",
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, inputText: "", state: "input-streaming" },
  { ...common, state: "input-available" },
  {
    ...common,
    output: createEvePlatformResult(
      {
        ...(imageMode
          ? { imageUrl: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png" }
          : {
              videoUrl: "/api/files/content?key=abcdefghijklmnopqrstuvwx.mp4",
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
    output: createEvePlatformResult(
      { error: "Upload failed after provider work completed." },
      0.5
    ),
    state: "output-available",
  },
  { ...common, output: { invalid: true }, state: "output-available" },
];
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
