/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";
import { createToolResult } from "../lib/eve/tool-result";

const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "input-available",
    toolCallId: "loading",
    toolName: "webSearch",
    type: "dynamic-tool",
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
    partial: true,
    state: "output-available",
    toolCallId: "progress",
    toolName: "webSearch",
    type: "dynamic-tool",
  },
  {
    errorText: "Search interrupted.",
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "output-error",
    toolCallId: "failed",
    toolName: "webSearch",
    type: "dynamic-tool",
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
    state: "output-available",
    toolCallId: "provider",
    toolName: "webSearch",
    type: "dynamic-tool",
  },
  {
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    output: {},
    state: "output-available",
    toolCallId: "malformed",
    toolName: "webSearch",
    type: "dynamic-tool",
  },
  {
    approval: { approved: false, id: "declined" },
    input: {
      search_queries: [{ query: "example", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    state: "output-denied",
    toolCallId: "denied",
    toolName: "webSearch",
    type: "dynamic-tool",
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
          { className: "rounded border p-3", key: part.toolCallId },
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
