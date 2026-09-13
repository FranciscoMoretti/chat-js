import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EvePlatformToolResult } from "../components/eve/eve-platform-tool-result";
import { createEvePlatformResult } from "../lib/eve/platform-result";

const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "loading",
    state: "input-available",
    input: {},
  },
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "progress",
    input: {},
    state: "output-available",
    partial: true,
    output: createEvePlatformResult({ searches: [] }, 0, [
      {
        type: "web",
        toolCallId: "progress",
        title: "Searching sources",
        status: "running",
        queries: ["example"],
      },
    ]),
  },
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "failed",
    input: {},
    state: "output-error",
    errorText: "Search interrupted.",
  },
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "provider",
    input: {},
    state: "output-available",
    output: createEvePlatformResult(
      {
        searches: [],
        error: "Some searches failed. Try again or use another source.",
      },
      0.05
    ),
  },
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "malformed",
    input: {},
    state: "output-available",
    output: {},
  },
  {
    type: "dynamic-tool",
    toolName: "webSearch",
    toolCallId: "denied",
    input: {},
    state: "output-denied",
    approval: { id: "declined", approved: false },
  },
];
process.stdout.write(
  renderToStaticMarkup(
    createElement(
      "main",
      { className: "mx-auto max-w-3xl space-y-5 p-5" },
      parts.map((part) =>
        createElement(
          "section",
          { key: part.toolCallId, className: "rounded border p-3" },
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
