import { act } from "react";
import { expect, test } from "vitest";

import type { ToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";

import { captureChatStory } from "../_shared/visual";
import { RetrieveUrlRenderer } from "./renderer";
import type { retrieveUrl } from "./tool";

type RetrieveUrlRendererTool = ToolPartFromTool<typeof retrieveUrl>;

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
        await act(() => {
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
  ]));
