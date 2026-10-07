/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ChatRenameDialog } from "@/components/chat-rename-dialog";

import "./sandbox.css";
/* oxlint-enable sort-imports */

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
    const renderDialog = async (
      currentTitle: string,
      isLoading = false,
      open = true
    ): Promise<void> => {
      await act(async () => {
        await Promise.resolve();
        root.render(
          <ChatRenameDialog
            open={open}
            currentTitle={currentTitle}
            onOpenChange={close}
            onSubmit={submit}
            isLoading={isLoading}
          />
        );
      });
    };
    await renderDialog("Original title");
    const titleInput = page.getByPlaceholder("Chat name");
    await page.getByPlaceholder("Chat name").fill("  Renamed chat  ");
    await act(async () => {
      await Promise.resolve();
      const save = page
        .getByRole("button", { exact: true, name: "Save" })
        .element();
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      titleInput
        .element()
        .dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
        );
      titleInput
        .element()
        .dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
        );
    });
    expect(submit).toHaveBeenCalledWith("Renamed chat");
    expect(close).not.toHaveBeenCalled();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Save" }))
      .toBeDisabled();
    titleInput
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    titleInput
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    expect(submit).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    await takeSnapshot("chat-rename-pending");
    await page.getByRole("dialog").screenshot();
    await renderDialog("Renamed chat", true);
    await act(async () => {
      await Promise.resolve();
      pending.reject(new Error("Network failure"));
    });
    await renderDialog("Original title");
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not rename chat. Try again.");
    await expect
      .element(page.getByPlaceholder("Chat name"))
      .toHaveValue("  Renamed chat  ");
    expect(close).not.toHaveBeenCalled();
    await takeSnapshot("chat-rename-failure");
    await page.getByRole("dialog").screenshot();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Save" }))
      .toBeEnabled();
    page
      .getByPlaceholder("Chat name")
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(submit).toHaveBeenLastCalledWith("Renamed chat");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await renderDialog("Server title", false, false);
    await renderDialog("Latest title");
    await expect
      .element(page.getByPlaceholder("Chat name"))
      .toHaveValue("Latest title");
    close.mockClear();
    submit.mockClear();
    await renderDialog("Latest title", true);
    await titleInput.fill("Another title");
    titleInput
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    expect(submit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    await renderDialog("Latest title");
    await titleInput.fill("Latest title");
    titleInput
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    expect(submit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
    close.mockClear();
    await titleInput.fill("  ");
    titleInput
      .element()
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    expect(submit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
  } finally {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
  }
});
/* oxlint-enable max-statements, max-lines-per-function */

/* oxlint-disable max-statements, max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals -- This browser lifecycle covers cancellation, a reopened dialog and stale completion for both conditional and persistent mounting. */
test.each([
  { externalClose: false, mounting: "conditional", outcome: "success" },
  { externalClose: false, mounting: "conditional", outcome: "failure" },
  { externalClose: false, mounting: "persistent", outcome: "success" },
  { externalClose: false, mounting: "persistent", outcome: "failure" },
  { externalClose: true, mounting: "conditional", outcome: "success" },
  { externalClose: true, mounting: "persistent", outcome: "success" },
])(
  "$mounting dialog ignores old $outcome after reopening (external close: $externalClose)",
  async ({
    mounting,
    outcome,
    externalClose,
  }: {
    readonly mounting: string;
    readonly outcome: string;
    readonly externalClose: boolean;
  }) => {
    const oldRequest = Promise.withResolvers<undefined>();
    const newRequest = Promise.withResolvers<undefined>();
    const requestsBeforeRetry = 2;
    const requestsAfterRetry = 3;
    const submit = vi
      .fn<(title: string) => Promise<void>>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)
      .mockResolvedValue();
    // oxlint-disable-next-line react/only-export-components -- This local controlled owner exists only inside the browser lifecycle test, not a Fast Refresh application module.
    const DialogOwner = (): React.JSX.Element => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open rename
          </button>
          <button
            data-external-close
            onClick={() => setOpen(false)}
            type="button"
          >
            Close externally
          </button>
          {(mounting === "persistent" || open) && (
            <ChatRenameDialog
              open={open}
              currentTitle="Original title"
              onOpenChange={setOpen}
              onSubmit={submit}
              isLoading={false}
            />
          )}
        </>
      );
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(<DialogOwner />);
      });
      await page.getByRole("button", { name: "Open rename" }).click();
      await page.getByPlaceholder("Chat name").fill("Old rename");
      await page.getByRole("button", { exact: true, name: "Save" }).click();
      expect(submit).toHaveBeenCalledOnce();
      if (externalClose) {
        await act(async () => {
          await Promise.resolve();
          const externalCloseButton = container.querySelector(
            "[data-external-close]"
          );
          if (!externalCloseButton) {
            throw new Error("Missing external dialog controller");
          }
          externalCloseButton.dispatchEvent(
            new MouseEvent("click", { bubbles: true })
          );
        });
      }
      if (!externalClose) {
        await page.getByRole("button", { name: "Cancel" }).click();
      }
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      await page.getByRole("button", { name: "Open rename" }).click();
      await page.getByPlaceholder("Chat name").fill("New rename");
      await page.getByRole("button", { exact: true, name: "Save" }).click();
      expect(submit).toHaveBeenCalledTimes(requestsBeforeRetry);
      await act(async () => {
        await Promise.resolve();
        if (outcome === "success") {
          // oxlint-disable-next-line no-undefined -- Resolve the deferred callback's explicit undefined completion, matching its typed resolver contract.
          oldRequest.resolve(undefined);
        } else {
          oldRequest.reject(new Error("Old request failed"));
        }
      });
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await expect
        .element(page.getByPlaceholder("Chat name"))
        .toHaveValue("New rename");
      await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
      await expect
        .element(page.getByRole("button", { exact: true, name: "Save" }))
        .toBeDisabled();
      page
        .getByPlaceholder("Chat name")
        .element()
        .dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
        );
      expect(submit).toHaveBeenCalledTimes(requestsBeforeRetry);
      if (
        mounting === "conditional" &&
        outcome === "success" &&
        !externalClose
      ) {
        await takeSnapshot("chat-rename-reopened-pending");
        await page.getByRole("dialog").screenshot();
      }
      await act(async () => {
        await Promise.resolve();
        newRequest.reject(new Error("New request failed"));
      });
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Could not rename chat. Try again.");
      await page.getByRole("button", { exact: true, name: "Save" }).click();
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      expect(submit).toHaveBeenCalledTimes(requestsAfterRetry);
      expect(submit).toHaveBeenLastCalledWith("New rename");
    } finally {
      await act(async () => {
        await Promise.resolve();
        root.unmount();
      });
      container.remove();
    }
  }
);
/* oxlint-enable max-statements, max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals */

/* oxlint-enable oxc/no-async-await */
