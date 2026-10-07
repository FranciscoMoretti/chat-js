import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ChatRenameDialog } from "@/components/chat-rename-dialog";

import "./sandbox.css";

/* oxlint-disable max-statements, max-lines-per-function -- This scenario verifies one rename rejection, retained input, and a subsequent successful keyboard retry with the same mounted dialog. */
test("rename rejection keeps the dialog and input until a successful retry", async () => {
  const pending = Promise.withResolvers<undefined>();
  const submit = vi
    .fn<(title: string) => Promise<void>>()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue();
  const close = vi.fn<(open: boolean) => void>();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <ChatRenameDialog
          open
          currentTitle="Original title"
          onOpenChange={close}
          onSubmit={submit}
          isLoading={false}
        />
      );
    });
    await page.getByPlaceholder("Chat name").fill("  Renamed chat  ");
    await page.getByRole("button", { exact: true, name: "Save" }).click();
    expect(submit).toHaveBeenCalledWith("Renamed chat");
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
      pending.reject(new Error("Network failure"));
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not rename chat. Try again.");
    await expect
      .element(page.getByPlaceholder("Chat name"))
      .toHaveValue("  Renamed chat  ");
    expect(close).not.toHaveBeenCalled();
    await takeSnapshot("chat-rename-failure");
    await page.getByPlaceholder("Chat name").fill("Second title");
    page
      .getByPlaceholder("Chat name")
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(submit).toHaveBeenLastCalledWith("Second title");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  } finally {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
  }
});
/* oxlint-enable max-statements, max-lines-per-function */
