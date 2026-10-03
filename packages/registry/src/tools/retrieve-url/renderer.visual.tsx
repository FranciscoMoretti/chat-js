/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import React from "react";
import { expect, test } from "vitest";

import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";

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

const emptyTool: RetrieveUrlRendererTool = {
  input,
  output: { results: [] },
  state: "output-available",
  toolCallId: "url-empty",
};

test("retrieve-url renders every state in the chat", () =>
  captureChatStory("retrieve-url", [
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
      label: "Retrieved, nothing extracted",
      // With no result the source link is a bare `#`, which resolves against the
      // per-run test page URL; pin it so the archive is the same every run.
      settle: (section) => {
        section
          .querySelector('a[href="#"]')
          ?.setAttribute("href", "https://example.com/#");
      },
      ui: (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={emptyTool}
        />
      ),
    },
  ]));
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/max-lines-per-function */
