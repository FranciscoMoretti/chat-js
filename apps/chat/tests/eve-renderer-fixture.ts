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
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "loading",
      state: "input-available",
      input: { text: "one two" },
    },
  },
  {
    label: "Complete",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "complete",
      state: "output-available",
      input: { text: "one two" },
      output: { words: 2, characters: 7, charactersNoSpaces: 6, sentences: 1 },
    },
  },
  {
    label: "Malformed result",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "invalid",
      state: "output-available",
      input: { text: "one two" },
      output: { words: {} },
    },
  },
  {
    label: "Failed",
    part: {
      type: "dynamic-tool",
      toolName: "getWeather",
      toolCallId: "failed",
      state: "output-error",
      input: {},
      errorText: "Weather service unavailable",
    },
  },
  {
    label: "Declined",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "denied",
      state: "output-denied",
      approval: { id: "approval-fixture", approved: false },
      input: { text: "one two" },
    },
  },
];
states.push(
  {
    label: "Preparing input",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "streaming",
      state: "input-streaming",
      inputText: '{"text":"one"',
      input: { text: "one" },
    },
  },
  {
    label: "Approval pending",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "approval",
      state: "approval-requested",
      input: { text: "one" },
      approval: { id: "approval" },
    },
  },
  {
    label: "Approval received",
    part: {
      type: "dynamic-tool",
      toolName: "wordCount",
      toolCallId: "approved",
      state: "approval-responded",
      input: { text: "one" },
      approval: { id: "approved", approved: true },
    },
  },
  {
    label: "Retrieving content",
    part: {
      type: "dynamic-tool",
      toolName: "retrieveUrl",
      toolCallId: "retrieving",
      state: "input-available",
      input: { url: "https://example.com" },
    },
  },
  {
    label: "Retrieved content",
    part: {
      type: "dynamic-tool",
      toolName: "retrieveUrl",
      toolCallId: "retrieved",
      state: "output-available",
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
    },
  },
  {
    label: "Weather loading",
    part: {
      type: "dynamic-tool",
      toolName: "getWeather",
      toolCallId: "weather-loading",
      state: "input-available",
      input: { latitude: 0, longitude: 0 },
    },
  }
);

const content = renderToStaticMarkup(
  createElement(
    "main",
    { className: "mx-auto max-w-3xl space-y-6 p-6" },
    states.map(({ label, part }) =>
      createElement(
        "section",
        { key: label, className: "space-y-2" },
        createElement("h2", { className: "font-semibold" }, label),
        createElement(EveToolResult, {
          messageId: "fixture",
          isReadonly: true,
          part,
        })
      )
    )
  )
);

process.stdout.write(content);
