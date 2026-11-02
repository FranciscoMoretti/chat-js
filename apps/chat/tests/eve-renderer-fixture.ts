import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { EveToolResult } from "../components/eve/eve-tool-result";

const states: {
  label: string;
  part: Extract<EveMessagePart, { type: "tool" }>;
}[] = [
  {
    label: "Loading",
    part: {
      input: { text: "one two" },
      state: "requested",
      callId: "loading",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Complete",
    part: {
      input: { text: "one two" },
      output: { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
      state: "completed",
      callId: "complete",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Malformed result",
    part: {
      input: { text: "one two" },
      output: { words: {} },
      state: "completed",
      callId: "invalid",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Failed",
    part: {
      error: { code: "fixture_error", message: "Weather service unavailable" },
      input: {},
      state: "failed",
      callId: "failed",
      name: "getWeather",
      label: "getWeather",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Declined",
    part: {
      input: { text: "one two" },
      state: "rejected",
      callId: "denied",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
      interaction: {
        interactionId: "approval-fixture",
        turnId: "fixture-turn",
        stepIndex: 0,
        status: "settled",
        outcome: "declined",
        request: { kind: "approval", prompt: "Approve this tool?" },
      },
    },
  },
  {
    label: "Preparing input",
    part: {
      inputText: '{"text":"one"',
      state: "streaming",
      callId: "streaming",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Approval pending",
    part: {
      input: { text: "one" },
      state: "approval",
      callId: "approval",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
      interaction: {
        interactionId: "approval",
        turnId: "fixture-turn",
        stepIndex: 0,
        status: "open",
        request: { kind: "approval", prompt: "Approve this tool?" },
      },
    },
  },
  {
    label: "Approval received",
    part: {
      input: { text: "one" },
      state: "requested",
      callId: "approved",
      name: "wordCount",
      label: "wordCount",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
      interaction: {
        interactionId: "approved",
        turnId: "fixture-turn",
        stepIndex: 0,
        status: "settled",
        outcome: "accepted",
        request: { kind: "approval", prompt: "Approve this tool?" },
      },
    },
  },
  {
    label: "Retrieving content",
    part: {
      input: { url: "https://example.com" },
      state: "requested",
      callId: "retrieving",
      name: "retrieveUrl",
      label: "retrieveUrl",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
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
      state: "completed",
      callId: "retrieved",
      name: "retrieveUrl",
      label: "retrieveUrl",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Weather loading",
    part: {
      input: { latitude: 0, longitude: 0 },
      state: "requested",
      callId: "weather-loading",
      name: "getWeather",
      label: "getWeather",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
];

const content = renderToStaticMarkup(
  createElement(
    "main",
    { className: "mx-auto max-w-3xl space-y-6 p-6" },
    states.map(
      ({ label, part }: ReadonlyNativeSurface<(typeof states)[number]>) =>
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
