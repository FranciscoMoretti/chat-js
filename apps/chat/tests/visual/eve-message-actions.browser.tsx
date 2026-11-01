import { MessageScrollerProvider } from "@/components/ui/message-scroller";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import type { EveMessage } from "eve/client";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EveMessages } from "@/components/eve/eve-messages";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { mount, renderRoot, unmount } from "./primitive-mount";
import "./sandbox.css";

vi.mock("@/components/ai-elements/response", () => ({
  Response: ({ children }: { readonly children: ReadonlyReactNode }) => (
    <div>{children}</div>
  ),
}));

const messages: EveMessage[] = [
  {
    id: "user-one",
    role: "user",
    metadata: { turnId: "turn_0" },
    parts: [{ type: "text", text: "First question" }],
  },
  {
    id: "answer-one",
    role: "assistant",
    metadata: { turnId: "turn_0" },
    parts: [{ type: "text", text: "First answer" }],
  },
  {
    id: "user-two",
    role: "user",
    metadata: { turnId: "turn_1" },
    parts: [{ type: "text", text: "Second question" }],
  },
  {
    id: "answer-two",
    role: "assistant",
    metadata: { turnId: "turn_1" },
    parts: [{ type: "text", text: "Second answer" }],
  },
];

test("message actions retain their user boundary and readonly behavior", async () => {
  const edit = vi.fn<(message: ReadonlyEveMessage) => void>();
  const regenerate =
    vi.fn<
      (message: ReadonlyEveMessage, response: ReadonlyEveMessage) => void
    >();
  const respond = vi.fn<() => void>();
  const modelForMessage = vi
    .fn<(message: ReadonlyEveMessage) => string>()
    .mockReturnValue("fixture-model");
  const render = (isReadonly: boolean) => (
    <TooltipProvider>
      <MessageScrollerProvider>
        <EveMessages
          disabled={false}
          isReadonly={isReadonly}
          messages={messages}
          respond={respond}
          onEdit={edit}
          onRegenerate={regenerate}
          modelForMessage={modelForMessage}
          renderVersions={(message, user) => (
            <span data-testid={`versions-${message.id}`}>
              {user?.id ?? "none"}
            </span>
          )}
        />
      </MessageScrollerProvider>
    </TooltipProvider>
  );
  const fixture = await mount(render(false));
  fixture.container.style.cssText = "width:800px;padding:24px";
  try {
    expect(
      fixture.container.querySelector('[data-testid="versions-answer-one"]')
        ?.textContent
    ).toBe("user-one");
    expect(
      fixture.container.querySelector('[data-testid="versions-answer-two"]')
        ?.textContent
    ).toBe("user-two");
    expect(modelForMessage).toHaveBeenCalledWith(messages[0]);
    await act(async () => {
      await page
        .getByRole("button", {
          name: "Regenerate response",
          exact: true,
        })
        .nth(1)
        .click();
    });
    expect(regenerate).toHaveBeenCalledExactlyOnceWith(
      messages[2],
      messages[3]
    );
    await act(async () => {
      await page
        .getByRole("button", {
          name: "Edit message",
          exact: true,
        })
        .nth(1)
        .click();
    });
    expect(edit).toHaveBeenCalledExactlyOnceWith(messages[2]);
    await page.getByText("First answer", { exact: true }).hover();
    // Base UI removes the role before its exit animation unmounts the portal.
    await expect
      .poll(() => document.querySelector('[data-slot="tooltip-content"]'))
      .toBeNull();
    await takeSnapshot("eve-message-action-boundaries");
    await page.elementLocator(fixture.container).screenshot();
    await renderRoot(fixture.root, render(true));
    await expect
      .element(
        page.getByRole("button", {
          name: "Regenerate response",
          exact: true,
        })
      )
      .not.toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: "Edit message",
          exact: true,
        })
      )
      .not.toBeInTheDocument();
    expect(fixture.container.textContent).toContain("Second answer");
  } finally {
    await unmount(fixture);
  }
});

test("message version actions retain navigation, labels and disabled boundaries", async () => {
  const previous = vi.fn<() => void>();
  const next = vi.fn<() => void>();
  const render = (index: number, disabled = false) => (
    <TooltipProvider>
      <div className="p-8">
        <MessageSiblingsView
          index={index}
          count={2}
          disabled={disabled}
          onPrevious={previous}
          onNext={next}
        />
      </div>
    </TooltipProvider>
  );
  const fixture = await mount(render(0));
  try {
    const previousButton = page.getByRole("button", {
      name: "Previous version",
      exact: true,
    });
    const nextButton = page.getByRole("button", {
      name: "Next version",
      exact: true,
    });
    await expect.element(previousButton).toBeDisabled();
    await expect.element(nextButton).toBeEnabled();
    await act(async () => {
      await nextButton.click();
    });
    expect(next).toHaveBeenCalledOnce();
    expect(previous).not.toHaveBeenCalled();
    await renderRoot(fixture.root, render(1));
    await expect.element(nextButton).toBeDisabled();
    await expect.element(previousButton).toBeEnabled();
    await act(async () => {
      await previousButton.click();
    });
    expect(previous).toHaveBeenCalledOnce();
    await renderRoot(fixture.root, render(1, true));
    await expect.element(previousButton).toBeDisabled();
    await expect.element(nextButton).toBeDisabled();
    await act(async () => {
      await page.getByText("2/2", { exact: true }).hover();
    });
    await expect
      .poll(() => document.querySelector('[data-slot="tooltip-content"]'))
      .toBeNull();
    await takeSnapshot("message-version-actions-disabled");
  } finally {
    await unmount(fixture);
  }
});
