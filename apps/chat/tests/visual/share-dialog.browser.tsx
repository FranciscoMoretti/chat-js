import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import {
  ShareDialog,
  ShareDialogView,
} from "@/plugins/sharing/ui/share-button";

import "./sandbox.css";

vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/components/upgrade-cta/login-prompt", () => ({
  LoginPrompt: () => null,
}));

const flushReact = async (update: () => void): Promise<void> => {
  await act(async () => {
    update();
    await Promise.resolve();
  });
};

test("share link confirms a completed copy and reports clipboard rejection", async () => {
  const copy: PromiseWithResolvers<void> = Promise.withResolvers();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockReturnValueOnce(copy.promise)
    .mockRejectedValueOnce(new Error("Clipboard permission denied"));
  const success = vi.spyOn(toast, "success");
  const failure = vi.spyOn(toast, "error");
  const container = document.createElement("div");
  document.body.append(container);
  document.documentElement.classList.add("dark");
  const root = createRoot(container);

  try {
    await flushReact(() => {
      root.render(
        <>
          <ShareDialog
            onOpenChange={vi.fn<(_open: boolean) => void>()}
            open
            renderContent={(onClose): React.JSX.Element => (
              <ShareDialogView
                chatId="clipboard-fixture"
                isPending={false}
                isPublic
                onClose={onClose}
                setVisibility={vi.fn<() => Promise<void>>().mockResolvedValue()}
              />
            )}
          />
          <Toaster position="top-center" theme="dark" />
        </>
      );
    });
    await page.getByRole("button", { name: "Get Link" }).click();
    await page.getByRole("button", { exact: true, name: "Copy" }).click();

    expect(clipboard).toHaveBeenCalledWith(
      `${globalThis.location.origin}/share/clipboard-fixture`
    );
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();

    await flushReact(() => {
      copy.resolve();
    });
    await expect
      .element(page.getByText("Share link copied to clipboard"))
      .toBeVisible();
    expect(success).toHaveBeenCalledExactlyOnceWith(
      "Share link copied to clipboard"
    );

    await flushReact(() => {
      toast.dismiss();
    });
    await page.getByRole("button", { exact: true, name: "Copy" }).click();
    await expect
      .element(page.getByText("Unable to copy share link."))
      .toBeVisible();
    expect(failure).toHaveBeenCalledExactlyOnceWith(
      "Unable to copy share link."
    );
    expect(success).toHaveBeenCalledTimes(1);
    const link = document.querySelector<HTMLInputElement>("#link");
    if (!link) {
      throw new Error("Missing share link field");
    }
    // Keep the captured fixture independent of Vitest's ephemeral server port.
    link.value = "https://chat.example.test/share/clipboard-fixture";
    await expect
      .poll(
        () =>
          page
            .getByText("Unable to copy share link.")
            .element()
            .closest<HTMLElement>("[data-sonner-toast]")?.dataset.mounted
      )
      .toBe("true");
    await takeSnapshot("share-dialog-clipboard-failure");
  } finally {
    await flushReact(() => {
      root.unmount();
    });
    toast.dismiss();
    container.remove();
    vi.restoreAllMocks();
  }
});
