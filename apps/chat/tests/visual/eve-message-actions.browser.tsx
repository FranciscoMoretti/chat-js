import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import type { EveMessage } from "eve/client";

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
    <EveMessages
      disabled={false}
      isReadonly={isReadonly}
      messages={messages}
      respond={respond}
      onEdit={edit}
      onRegenerate={regenerate}
      modelForMessage={modelForMessage}
      renderVersions={(message, user) => (
        <span data-testid={`versions-${message.id}`}>{user?.id ?? "none"}</span>
      )}
    />
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
          name: "Copy completed conversation and ask again",
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
          name: "Copy conversation with edited prompt",
          exact: true,
        })
        .nth(1)
        .click();
    });
    expect(edit).toHaveBeenCalledExactlyOnceWith(messages[2]);
    await takeSnapshot("eve-message-action-boundaries");
    await page.elementLocator(fixture.container).screenshot();
    await renderRoot(fixture.root, render(true));
    await expect
      .element(
        page.getByRole("button", {
          name: "Copy completed conversation and ask again",
          exact: true,
        })
      )
      .not.toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: "Copy conversation with edited prompt",
          exact: true,
        })
      )
      .not.toBeInTheDocument();
    expect(fixture.container.textContent).toContain("Second answer");
  } finally {
    await unmount(fixture);
  }
});
