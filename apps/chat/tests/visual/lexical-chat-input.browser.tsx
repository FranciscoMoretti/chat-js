import "./sandbox.css";

import React, { act, createRef } from "react";
import { expect, test, vi } from "vitest";
import { mount, unmount } from "./primitive-mount";
import { LexicalChatInput } from "@/components/lexical-chat-input";
import type { LexicalChatInputRef } from "@/components/lexical-chat-input";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

/* oxlint-disable oxc/no-async-await -- Await native React commits, Lexical updates, browser editing and capture before cleanup. */
/* oxlint-disable max-lines-per-function, max-statements -- One two-editor lifecycle checks independent state through native typing, parent rerender, imperative clear and ref cleanup. */
test("lexical inputs keep independent native editor lifecycles", async () => {
  const editableRef = createRef<LexicalChatInputRef>();
  const readOnlyRef = createRef<LexicalChatInputRef>();
  const render = (initialValue: string): React.JSX.Element => (
    <div className="grid gap-6 p-6">
      <section>
        <LexicalChatInput
          aria-label="Editable message"
          // oxlint-disable-next-line react/forbid-component-props -- LexicalChatInput forwards className to native ContentEditable for fixture layout.
          className="min-h-16 rounded-md border p-3"
          data-testid="editable-input"
          initialValue={initialValue}
          placeholder="Write a message"
          ref={editableRef}
        />
      </section>
      <section>
        <LexicalChatInput
          aria-label="Read-only message"
          // oxlint-disable-next-line react/forbid-component-props -- LexicalChatInput forwards className to native ContentEditable for fixture layout.
          className="min-h-16 rounded-md border p-3"
          data-testid="read-only-input"
          initialValue="Read-only message remains independent."
          readOnly
          ref={readOnlyRef}
        />
      </section>
    </div>
  );
  const fixture = await mount(render("Initial editable message."));
  try {
    await expect
      .element(page.getByTestId("editable-input"))
      .toHaveTextContent("Initial editable message.");
    await expect
      .element(page.getByTestId("read-only-input"))
      .toHaveAttribute("contenteditable", "false");
    await expect
      .element(page.getByTestId("editable-input"))
      .toHaveAttribute("contenteditable", "true");
    const editableHandle = editableRef.current;
    const readOnlyHandle = readOnlyRef.current;
    expect(editableHandle).not.toBeNull();
    expect(readOnlyHandle).not.toBeNull();
    if (editableHandle === null || readOnlyHandle === null) {
      throw new Error(
        "Both native editor handles must mount before the lifecycle check."
      );
    }
    await act(async () => {
      await page.getByTestId("editable-input").fill("Typed editable message.");
    });
    await vi.waitFor(() => {
      expect(editableHandle.getValue()).toBe("Typed editable message.");
      expect(readOnlyHandle.getValue()).toBe(
        "Read-only message remains independent."
      );
    });
    act(() => {
      fixture.root.render(render("Parent updated editable message."));
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(editableHandle.getValue()).toBe(
          "Parent updated editable message."
        );
      });
    });
    expect(editableRef.current).toBe(editableHandle);
    expect(readOnlyRef.current).toBe(readOnlyHandle);
    act(() => {
      editableHandle.clear();
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(editableHandle.getValue()).toBe("");
        expect(readOnlyHandle.getValue()).toBe(
          "Read-only message remains independent."
        );
      });
    });
    await expect.element(page.getByText("Write a message")).toBeVisible();
    await takeSnapshot("lexical-independent-editors");
    await page.getByRole("main").screenshot();
  } finally {
    await unmount(fixture);
  }
  expect(editableRef.current).toBeNull();
  expect(readOnlyRef.current).toBeNull();
});
/* oxlint-enable max-lines-per-function, max-statements */
/* oxlint-enable oxc/no-async-await */
