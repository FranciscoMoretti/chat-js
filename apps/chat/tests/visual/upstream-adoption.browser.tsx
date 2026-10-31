import React from "react";
import { expect, test, vi } from "vitest";
import { page, commands, userEvent } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { EvePendingInput } from "@/components/eve/eve-pending-input";
import type { EveMessageInputRequest, InputResponse } from "eve/client";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextInputUsage,
  ContextOutputUsage,
} from "@/components/ai-elements/context";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { WebSourceBadge } from "@/components/source-badge";
import { EveSearchResultsView } from "@/chatjs/plugins/search/search-results-view";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

const question: EveMessageInputRequest = {
  requestId: "fixture-question",
  kind: "question",
  display: "select",
  prompt: "Which topic should we research?",
  options: [
    {
      id: "accessibility",
      label: "Accessibility",
      description: "Keyboard and screen reader support",
    },
    { id: "performance", label: "Performance" },
  ],
  allowFreeform: true,
};
const approval: EveMessageInputRequest = {
  requestId: "fixture-approval",
  kind: "tool-approval",
  display: "confirmation",
  prompt: "Delete this document?",
  options: [
    { id: "deny", label: "Keep document" },
    { id: "approve", label: "Delete document", style: "danger" },
  ],
};

for (const viewport of [
  { width: 960, dir: "ltr" },
  { width: 390, dir: "rtl" },
] as const) {
  test(`upstream questions and feedback at ${viewport.width} ${viewport.dir}`, async () => {
    await page.viewport(viewport.width, 1000);
    await commands.faviconAssets();
    const respond = vi.fn<(response: InputResponse) => void>();
    const send = vi.fn<(text: string) => void>();
    const fixture = await mount(
      <main
        dir={viewport.dir}
        className="mx-auto flex max-w-2xl flex-col gap-6 p-4"
      >
        <EvePendingInput
          request={question}
          disabled={false}
          respond={respond}
        />
        <EvePendingInput
          request={approval}
          disabled={false}
          respond={respond}
        />
        <section aria-label="Read-only approval">
          <EvePendingInput request={approval} disabled respond={respond} />
        </section>
        <Context
          usedTokens={2400}
          maxTokens={10_000}
          usage={{ inputTokens: 2000, outputTokens: 400, totalTokens: 2400 }}
        >
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
            <ContextContentBody>
              <ContextInputUsage />
              <ContextOutputUsage />
            </ContextContentBody>
          </ContextContent>
        </Context>
        <Suggestions>
          {[
            "Explain the tradeoffs",
            "Show an example",
            "Compare alternatives",
          ].map((text) => (
            <Suggestion key={text} suggestion={text} onClick={send} />
          ))}
        </Suggestions>
        <WebSourceBadge
          result={{
            title: "Accessible interfaces",
            url: "https://example.test/accessibility",
            content: "Keyboard navigation matters.",
            source: "web",
          }}
        />
      </main>
    );
    try {
      await expect
        .element(page.getByRole("radio", { name: /Accessibility/u }))
        .toBeVisible();
      await page.getByRole("button", { name: "Submit answer" }).click();
      expect(respond).not.toHaveBeenCalled();
      await page.getByRole("radio", { name: /Accessibility/u }).click();
      expect(respond).not.toHaveBeenCalled();
      await page.getByRole("button", { name: "Submit answer" }).click();
      expect(respond).toHaveBeenLastCalledWith({
        requestId: question.requestId,
        optionId: "accessibility",
      });
      respond.mockClear();
      const answer = page.getByRole("textbox", { name: "Your answer" });
      await answer.fill("  Security");
      await answer.click();
      await userEvent.keyboard("{End}{Enter}Privacy  ");
      await expect.element(answer).toHaveValue("  Security\nPrivacy  ");
      expect(respond).not.toHaveBeenCalled();
      await page.getByRole("button", { name: "Submit answer" }).click();
      expect(respond).toHaveBeenLastCalledWith({
        requestId: question.requestId,
        text: "Security\nPrivacy",
      });
      await page
        .getByRole("button", { name: "Delete document", exact: true })
        .first()
        .click();
      expect(respond).toHaveBeenLastCalledWith({
        requestId: approval.requestId,
        optionId: "approve",
      });
      await expect
        .element(
          page
            .getByRole("button", { name: "Delete document", exact: true })
            .last()
        )
        .toBeDisabled();
      await page.getByRole("button", { name: "Explain the tradeoffs" }).click();
      expect(send).toHaveBeenCalledExactlyOnceWith("Explain the tradeoffs");
      await takeSnapshot(
        `questions-approval-context-suggestions-${viewport.width}-${viewport.dir}`
      );
      await page.getByRole("button", { name: "24% context" }).hover();
      await expect
        .element(page.getByRole("progressbar", { name: "Context used" }))
        .toBeVisible();
      await expect
        .element(page.getByText("Input", { exact: true }))
        .toBeVisible();
      await page.getByText(question.prompt, { exact: true }).hover();
      await expect
        .poll(() =>
          page.getByRole("progressbar", { name: "Context used" }).query()
        )
        .toBeNull();
      await page
        .getByRole("link", {
          name: "Accessible interfaces — example.test (opens in a new tab)",
          exact: true,
        })
        .first()
        .hover();
      await expect
        .element(page.getByText("Accessible interfaces", { exact: true }))
        .toBeVisible();
      await takeSnapshot(`source-preview-${viewport.width}-${viewport.dir}`);
    } finally {
      await unmount(fixture);
    }
  });

  test(`search empty and error feedback at ${viewport.width} ${viewport.dir}`, async () => {
    await page.viewport(viewport.width, 900);
    const retry = vi.fn<() => void>();
    const noop = vi.fn<() => void>();
    const fixture = await mount(
      <main dir={viewport.dir} className="mx-auto grid max-w-2xl gap-4 p-4">
        {[false, true].map((error) => (
          <EveSearchResultsView
            key={String(error)}
            disableLoadMore
            error={error}
            hasMore={false}
            isSearch
            items={[]}
            loadingMore={false}
            onClose={noop}
            onLoadMore={noop}
            onQueryChange={noop}
            onRetry={retry}
            onSelect={noop}
            pending={false}
            query="espresso"
            searching={false}
          />
        ))}
      </main>
    );
    try {
      await expect
        .element(page.getByText("No chats found. Try different words."))
        .toBeVisible();
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Could not search chats.");
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      expect(retry).toHaveBeenCalledOnce();
      await takeSnapshot(
        `search-empty-error-${viewport.width}-${viewport.dir}`
      );
    } finally {
      await unmount(fixture);
    }
  });
}
