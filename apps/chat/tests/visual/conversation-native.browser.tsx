import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { EveMessages } from "@/components/eve/eve-messages";
import { AttachmentList } from "@/components/attachment-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
import { mount, renderRoot, unmount } from "./primitive-mount";
import "./sandbox.css";

vi.mock("@/components/ai-elements/response", () => ({
  Response: ({ children }: { readonly children: string }) => (
    <div style={{ whiteSpace: "pre-line" }}>{children}</div>
  ),
}));

const answer = "A streamed paragraph keeps the answer readable.\n".repeat(12);
const messages: readonly ReadonlyEveMessage[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    parts: [
      { type: "text", text: index % 2 === 0 ? `Question ${index}` : answer },
    ],
  })
);
const noop = (): void => {
  /* Read-only fixture. */
};
const Transcript = ({
  items,
}: {
  readonly items: readonly ReadonlyEveMessage[];
}) => (
  <TooltipProvider>
    <div style={{ width: 640, height: 420 }}>
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-4">
              <EveMessages
                disabled={false}
                isReadonly
                messages={items}
                respond={noop}
                messageKey={(message) => message.metadata?.turnId ?? message.id}
              />
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  </TooltipProvider>
);

test("native transcript follows streaming, releases manual scroll, and preserves prepended history and logical identity", async () => {
  const fixture = await mount(<Transcript items={messages} />);
  try {
    const viewport = fixture.container.querySelector(
      '[data-slot="message-scroller-viewport"]'
    );
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("Missing transcript viewport");
    }
    const atEnd = () =>
      Math.abs(
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
      ) < 3;
    await expect.poll(atEnd).toBe(true);
    const last = messages.at(-1);
    if (!last) {
      throw new Error("Missing final message");
    }
    const stream = [
      ...messages.slice(0, -1),
      { ...last, parts: [{ type: "text" as const, text: answer.repeat(2) }] },
    ];
    await renderRoot(fixture.root, <Transcript items={stream} />);
    await expect.poll(atEnd).toBe(true);
    act(() => {
      viewport.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -300, bubbles: true })
      );
      viewport.scrollTop -= 300;
      viewport.dispatchEvent(new Event("scroll"));
    });
    const readingPosition = viewport.scrollTop;
    const longer = [
      ...messages.slice(0, -1),
      { ...last, parts: [{ type: "text" as const, text: answer.repeat(3) }] },
    ];
    await renderRoot(fixture.root, <Transcript items={longer} />);
    await expect
      .poll(() => Math.abs(viewport.scrollTop - readingPosition))
      .toBeLessThan(3);
    await expect
      .element(page.getByRole("button", { name: "Scroll to end" }))
      .toBeEnabled();
    await act(async () => {
      await page.getByRole("button", { name: "Scroll to end" }).click();
    });
    await expect.poll(atEnd).toBe(true);

    act(() => {
      viewport.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -1000, bubbles: true })
      );
      viewport.scrollTop = 100;
      viewport.dispatchEvent(new Event("scroll"));
    });
    const existing = fixture.container.querySelector(
      '[data-message-id="message-1"]'
    );
    if (!(existing instanceof HTMLElement)) {
      throw new Error("Missing history anchor");
    }
    const anchorTop = existing.getBoundingClientRect().top;
    await renderRoot(
      fixture.root,
      <Transcript
        items={[
          {
            id: "older",
            role: "assistant",
            parts: [{ type: "text", text: answer }],
          },
          ...longer,
        ]}
      />
    );
    await expect
      .poll(() => Math.abs(existing.getBoundingClientRect().top - anchorTop))
      .toBeLessThan(3);
    expect(fixture.container.contains(existing)).toBe(true);
    await takeSnapshot("native-conversation-history-and-streaming");
    await page.elementLocator(fixture.container).screenshot();

    const logical: readonly ReadonlyEveMessage[] = [
      {
        id: "optimistic",
        role: "assistant",
        metadata: { turnId: "stable-turn" },
        parts: [{ type: "text", text: answer }],
      },
    ];
    await renderRoot(fixture.root, <Transcript items={logical} />);
    const stable = fixture.container.querySelector(
      '[data-message-id="stable-turn"]'
    );
    await renderRoot(
      fixture.root,
      <Transcript
        items={[
          {
            id: "persisted",
            role: "assistant",
            metadata: { turnId: "stable-turn" },
            parts: [{ type: "text", text: answer }],
          },
        ]}
      />
    );
    expect(
      fixture.container.querySelector('[data-message-id="stable-turn"]')
    ).toBe(stable);
  } finally {
    await unmount(fixture);
  }
});

test("native attachment states keep keyboard removal separate from preview and open actions", async () => {
  const remove =
    vi.fn<
      (attachment: { name: string; contentType: string; url: string }) => void
    >();
  const fixture = await mount(
    <main className="flex flex-col gap-6 p-6" style={{ width: 600 }}>
      <AttachmentList
        attachments={[
          {
            name: "report.pdf",
            contentType: "application/pdf",
            url: "/report.pdf",
          },
        ]}
        onRemoveAction={remove}
      />
      <AttachmentList
        variant="pill"
        attachments={[
          { name: "notes.txt", contentType: "text/plain", url: "/notes.txt" },
        ]}
        onRemoveAction={remove}
      />
      <AttachmentList attachments={[]} uploadQueue={["uploading.pdf"]} />
      <AttachmentList
        attachments={[
          {
            name: "broken.png",
            contentType: "image/png",
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'/%3E",
          },
        ]}
      />
    </main>
  );
  try {
    const preview = fixture.container.querySelector('img[alt="broken.png"]');
    if (!(preview instanceof HTMLImageElement)) {
      throw new Error("Missing attachment image");
    }
    act(() => {
      preview.dispatchEvent(new Event("error"));
    });
    await expect
      .element(page.getByText("Preview unavailable"))
      .toBeInTheDocument();
    expect(fixture.container.querySelector("button button")).toBeNull();
    expect(
      fixture.container.querySelectorAll('[data-state="uploading"]')
    ).toHaveLength(1);
    expect(
      fixture.container.querySelectorAll('[data-state="uploading"] button')
    ).toHaveLength(0);
    await takeSnapshot("native-attachments-ready-uploading-unavailable");
    await page.elementLocator(fixture.container).screenshot();
    await act(async () => {
      await page
        .getByRole("button", { name: "Remove attachment" })
        .first()
        .click();
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith({
      name: "report.pdf",
      contentType: "application/pdf",
      url: "/report.pdf",
    });
    await act(async () => {
      await page
        .getByRole("button", { name: "notes.txt", exact: true })
        .hover();
    });
    await expect
      .element(page.getByRole("button", { name: "Open", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Download", exact: true }))
      .toBeVisible();
  } finally {
    await unmount(fixture);
  }
});
