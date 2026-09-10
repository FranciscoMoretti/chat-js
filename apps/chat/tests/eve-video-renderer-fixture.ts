import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvePlatformToolResult } from "../components/eve/eve-platform-tool-result";
import { createEvePlatformResult } from "../lib/eve/platform-result";

const imageMode = process.argv.includes("--image");
const common = {
  type: "dynamic-tool",
  toolName: imageMode ? "generateImage" : "generateVideo",
  toolCallId: "fixture",
  input: { prompt: "A tree in the wind" },
} as const;
const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  { ...common, state: "input-streaming", inputText: "" },
  { ...common, state: "input-available" },
  {
    ...common,
    state: "output-available",
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
  },
  {
    ...common,
    state: "output-error",
    errorText: imageMode
      ? "Image provider unavailable"
      : "Video provider unavailable",
  },
  {
    ...common,
    state: "output-denied",
    approval: { id: "fixture", approved: false },
  },
  {
    ...common,
    state: "output-available",
    output: createEvePlatformResult(
      { error: "Upload failed after provider work completed." },
      0.5
    ),
  },
  { ...common, state: "output-available", output: { invalid: true } },
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
          createElement(EvePlatformToolResult, {
            part,
            messageId: "fixture",
            isReadonly: true,
          })
        )
      )
    )
  )
);
