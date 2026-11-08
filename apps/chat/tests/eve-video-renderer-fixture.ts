import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createToolResult } from "../lib/eve/tool-result";

const imageMode = process.argv.includes("--image");
const common = {
  input: { prompt: "A tree in the wind" },
  callId: "fixture",
  name: imageMode ? "generateImage" : "generateVideo",
  label: imageMode ? "generateImage" : "generateVideo",
  type: "tool",
  kind: "tool",
  stepIndex: 0,
} as const;
const parts: Extract<EveMessagePart, { type: "tool" }>[] = [
  { ...common, input: undefined, inputText: "", state: "streaming" },
  { ...common, state: "requested" },
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
    state: "completed",
  },
  {
    ...common,
    error: {
      code: "fixture_error",
      message: imageMode
        ? "Image provider unavailable"
        : "Video provider unavailable",
    },
    state: "failed",
  },
  {
    ...common,

    state: "rejected",
  },
  {
    ...common,
    output: createToolResult(
      { error: "Upload failed after provider work completed." },
      0.5
    ),
    state: "completed",
  },
  { ...common, output: { invalid: true }, state: "completed" },
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
