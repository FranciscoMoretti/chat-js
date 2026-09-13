/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";

const states: {
  label: string;
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}[] = [
  {
    label: "Loading",
    part: {
      input: { text: "one two" },
      state: "input-available",
      toolCallId: "loading",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Complete",
    part: {
      input: { text: "one two" },
      output: { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
      state: "output-available",
      toolCallId: "complete",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Malformed result",
    part: {
      input: { text: "one two" },
      output: { words: {} },
      state: "output-available",
      toolCallId: "invalid",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Failed",
    part: {
      errorText: "Weather service unavailable",
      input: {},
      state: "output-error",
      toolCallId: "failed",
      toolName: "getWeather",
      type: "dynamic-tool",
    },
  },
  {
    label: "Declined",
    part: {
      approval: { approved: false, id: "approval-fixture" },
      input: { text: "one two" },
      state: "output-denied",
      toolCallId: "denied",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Preparing input",
    part: {
      input: { text: "one" },
      inputText: '{"text":"one"',
      state: "input-streaming",
      toolCallId: "streaming",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Approval pending",
    part: {
      approval: { id: "approval" },
      input: { text: "one" },
      state: "approval-requested",
      toolCallId: "approval",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Approval received",
    part: {
      approval: { approved: true, id: "approved" },
      input: { text: "one" },
      state: "approval-responded",
      toolCallId: "approved",
      toolName: "wordCount",
      type: "dynamic-tool",
    },
  },
  {
    label: "Retrieving content",
    part: {
      input: { url: "https://example.com" },
      state: "input-available",
      toolCallId: "retrieving",
      toolName: "retrieveUrl",
      type: "dynamic-tool",
    },
  },
  {
    label: "Retrieved content",
    part: {
      input: { url: "https://example.com" },
      output: {
        results: [
          {
            title: "Example page",
            description: "A deterministic renderer fixture.",
            content: "This is the retrieved content.",
            url: "https://example.com",
            language: "en",
          },
        ],
      },
      state: "output-available",
      toolCallId: "retrieved",
      toolName: "retrieveUrl",
      type: "dynamic-tool",
    },
  },
  {
    label: "Weather loading",
    part: {
      input: { latitude: 0, longitude: 0 },
      state: "input-available",
      toolCallId: "weather-loading",
      toolName: "getWeather",
      type: "dynamic-tool",
    },
  },
];

const content = renderToStaticMarkup(
  createElement(
    "main",
    { className: "mx-auto max-w-3xl space-y-6 p-6" },
    states.map(({ label, part }) =>
      createElement(
        "section",
        { className: "space-y-2", key: label },
        createElement("h2", { className: "font-semibold" }, label),
        createElement(EveToolResult, {
          isReadonly: true,
          messageId: "fixture",
          part,
        })
      )
    )
  )
);

process.stdout.write(content);
