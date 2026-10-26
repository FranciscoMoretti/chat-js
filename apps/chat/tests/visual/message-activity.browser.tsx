import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page, commands } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { captureChatStory } from "../../../../packages/registry/src/tools/_shared/visual";
import { McpToolResult } from "@/components/part/mcp-tool-result";
import { SandboxComposed } from "@/components/sandbox";
import {
  DocumentToolCall,
  DocumentToolResult,
} from "@/components/part/document-common";
import { Sources } from "@/components/sources";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

const setArtifact = vi.fn();
vi.mock("@/hooks/use-artifact", () => ({
  useArtifact: () => ({ setArtifact }),
}));
vi.mock("@/components/eve/eve-document-context", () => ({
  useDocumentConversation: () => "qa-conversation",
}));

const states = [
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "output-denied",
  "output-error",
  "output-available",
] as const;

test("native traces preserve all tool states and falsy outputs", async () => {
  await captureChatStory("message-activity", [
    ...states.map((state) => ({
      label: state,
      ui: (
        <McpToolResult
          defaultOpen
          part={{
            toolName: "Lookup inventory",
            state,
            input: { product: "ChatJS" },
            output: { available: true },
            errorText: "Provider unavailable. Try again.",
          }}
        />
      ),
    })),
    ...[false, 0, "", null].map((output) => ({
      label: `Output: ${JSON.stringify(output)}`,
      ui: (
        <McpToolResult
          defaultOpen
          part={{
            toolName: "Result",
            state: "output-available",
            output,
            input: undefined,
          }}
        />
      ),
    })),
    {
      label: "Streaming reasoning",
      ui: (
        <ReasoningPart content="Comparing the available evidence." isLoading />
      ),
    },
    {
      label: "Code execution",
      ui: (
        <SandboxComposed
          code='print("Hello")'
          language="python"
          output="Hello"
          state="output-available"
        />
      ),
      settle: async (section) => {
        await expect
          .poll(() => section.querySelector('[style*="--shiki-light"]'))
          .not.toBeNull();
      },
    },
  ]);
});

test.each([1000, 390])(
  "sources open directly and restore focus at %i pixels",
  async (width) => {
    await page.viewport(width, 844);
    await commands.faviconAssets();
    const fixture = await mount(
      <Sources
        sources={[
          {
            title: "Shadcn documentation",
            source: "web",
            content: "Native components",
            url: "https://ui.shadcn.com",
          },
        ]}
      />
    );
    try {
      const trigger = page.getByRole("button", { name: "Show all sources" });
      await act(async () => {
        await trigger.click();
      });
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await expect
        .element(page.getByRole("link", { name: "Shadcn documentation" }))
        .toHaveAttribute("href", "https://ui.shadcn.com");
      await takeSnapshot(`sources-open-${width}`);
      await act(async () => {
        await page.getByRole("button", { name: "Close", exact: true }).click();
      });
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      await expect
        .poll(() => document.activeElement === trigger.element())
        .toBe(true);
    } finally {
      await unmount(fixture);
    }
  }
);

test("document activity keeps loading, completed, disabled and revision actions", async () => {
  await captureChatStory("document-activity", [
    ...(["create", "update", "read"] as const).flatMap((type) => [
      {
        label: `${type} in progress`,
        ui: (
          <DocumentToolCall
            type={type}
            args={{ title: "QA document" }}
            isReadonly={false}
          />
        ),
      },
      {
        label: `${type} completed`,
        ui: (
          <DocumentToolResult
            type={type}
            isReadonly
            messageId="message"
            result={{
              id: "document",
              title: "QA document",
              kind: "text",
              revisionId: "revision",
            }}
          />
        ),
      },
    ]),
    {
      label: "Unavailable document",
      ui: (
        <DocumentToolResult
          type="read"
          disabled
          isReadonly
          messageId="message"
          result={{
            id: "document",
            title: "Unavailable document",
            kind: "text",
          }}
        />
      ),
    },
  ]);
  const fixture = await mount(
    <DocumentToolResult
      type="read"
      isReadonly
      messageId="message"
      result={{
        id: "document",
        title: "QA document",
        kind: "text",
        revisionId: "revision",
      }}
    />
  );
  try {
    await page
      .getByRole("button", { name: 'Read "QA document"', exact: true })
      .click();
    expect(setArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "document",
        revisionId: "revision",
        followLive: false,
        isVisible: true,
      })
    );
  } finally {
    await unmount(fixture);
  }
});
