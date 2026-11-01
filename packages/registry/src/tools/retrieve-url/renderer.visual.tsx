import React from "react";
import { expect, test } from "vitest";

import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";

import { captureChatStory, flush } from "../_shared/visual";
import { RetrieveUrlRenderer } from "./renderer";
import type { retrievedInput, retrievedResult } from "./schemas";

type RetrieveUrlRendererTool = ToolRendererProps<
  typeof retrievedInput,
  typeof retrievedResult
>["tool"];

const messageId = "url-message";
const input = { url: "https://example.com" };

const loadingTool: RetrieveUrlRendererTool = {
  input,
  state: "input-available",
  toolCallId: "url-input",
};

const errorTool: RetrieveUrlRendererTool = {
  input,
  output: { error: "The page could not be reached (503)." },
  state: "output-available",
  toolCallId: "url-error",
};

const successTool: RetrieveUrlRendererTool = {
  input,
  output: {
    results: [
      {
        content:
          "# A retrieved page\n\nReadable content extracted from the source, rendered as Markdown inside the expandable panel.",
        description:
          "A short summary of the retrieved page, shown under the title.",
        language: "English",
        title: "Retrieved page",
        url: "https://example.com",
      },
    ],
  },
  state: "output-available",
  toolCallId: "url-output",
};

// A result with no readable fields (a malformed item parses to this): the card
// falls back to its placeholder title, description and language.
const malformedTool: RetrieveUrlRendererTool = {
  input,
  output: { results: [{ error: undefined }] },
  state: "output-available",
  toolCallId: "url-malformed",
};

// With no usable result the source link is a bare `#`, which resolves against
// the per-run test page URL; pin it so the archive is the same every run.
const pinBareLink = (section: HTMLElement): void => {
  section
    .querySelector('a[href="#"]')
    ?.setAttribute("href", "https://example.com/#");
};

const emptyTool: RetrieveUrlRendererTool = {
  input,
  output: { results: [] },
  state: "output-available",
  toolCallId: "url-empty",
};

test("retrieve-url renders every state in the chat", async () => {
  await captureChatStory("retrieve-url", [
    {
      label: "Retrieving (skeleton)",
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={loadingTool}
        />
      ),
    },
    {
      label: "Error",
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={errorTool}
        />
      ),
    },
    {
      label: "Retrieved (expanded)",
      // Open the "View content" disclosure so the expanded Markdown body is
      // captured, not just the collapsed header.
      settle: async (section) => {
        const details = section.querySelector("details");
        if (!details) {
          throw new Error("retrieve-url disclosure missing");
        }
        await flush(() => {
          details.open = true;
        });
        await expect
          .poll(() => section.textContent)
          .toContain("Readable content");
      },
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={successTool}
        />
      ),
    },
    {
      label: "Retrieved, unreadable result",
      settle: async (section) => {
        pinBareLink(section);
        await expect
          .poll(() => section.textContent)
          .toMatch(/Retrieved Content.*Unknown.*No content available/u);
      },
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={malformedTool}
        />
      ),
    },
    {
      label: "Retrieved, nothing extracted",
      settle: pinBareLink,
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={emptyTool}
        />
      ),
    },
  ]);
});
