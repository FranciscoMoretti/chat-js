import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createToolResult } from "../lib/eve/tool-result";

const parts: Extract<EveMessagePart, { type: "tool" }>[] = [
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "requested",
    callId: "loading",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    output: createToolResult({ searches: [] }, 0, [
      {
        type: "web",
        toolCallId: "progress",
        title: "Searching sources",
        status: "running",
        queries: ["example"],
      },
    ]),
    state: "running",
    callId: "progress",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    error: { code: "fixture_error", message: "Search interrupted." },
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "failed",
    callId: "failed",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    output: createToolResult(
      {
        searches: [],
        error: "Some searches failed. Try again or use another source.",
      },
      0.05
    ),
    state: "completed",
    callId: "provider",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    output: {},
    state: "completed",
    callId: "malformed",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "rejected",
    callId: "denied",
    name: "webSearch",
    label: "webSearch",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
    interaction: {
      interactionId: "declined",
      turnId: "fixture-turn",
      stepIndex: 0,
      status: "settled",
      outcome: "declined",
      request: { kind: "approval", prompt: "Approve this tool?" },
    },
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
          { className: "rounded border p-3", key: part.callId },
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
