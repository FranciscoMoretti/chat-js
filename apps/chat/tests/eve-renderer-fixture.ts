import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveToolResult } from "../components/eve/eve-tool-result";

const input = { path: "/workspace/sample-notes.md" };

const states: {
  label: string;
  part: Extract<EveMessagePart, { type: "tool" }>;
}[] = [
  {
    label: "Loading",
    part: {
      input,
      state: "requested",
      callId: "loading",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Complete",
    part: {
      input,
      output: {
        fileId: "abcdefghijklmnopqrstuvwx.md",
        name: "sample-notes.md",
        mediaType: "text/plain",
        size: 7,
        url: "/api/files/abcdefghijklmnopqrstuvwx.md",
      },
      state: "completed",
      callId: "complete",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Malformed result",
    part: {
      input,
      output: { size: {} },
      state: "completed",
      callId: "invalid",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Failed",
    part: {
      error: { code: "fixture_error", message: "File storage unavailable" },
      input,
      state: "failed",
      callId: "failed",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Declined",
    part: {
      input,
      state: "rejected",
      callId: "denied",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
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
      inputText: '{"path":"/workspace/sample-notes.md"',
      state: "streaming",
      callId: "streaming",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
      type: "tool",
      kind: "tool",
      stepIndex: 0,
    },
  },
  {
    label: "Approval pending",
    part: {
      input,
      state: "approval",
      callId: "approval",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
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
      input,
      state: "requested",
      callId: "approved",
      name: "attach_workspace_file",
      label: "attach_workspace_file",
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
];

const content = renderToStaticMarkup(
  createElement(
    "main",
    { className: "mx-auto max-w-3xl space-y-6 p-6" },
    states.map(({ label, part }: Readonly<(typeof states)[number]>) =>
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
