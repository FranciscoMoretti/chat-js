import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ShareDialog, ShareDialogView } from "@/components/share-button";

import "./sandbox.css";

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- share-dialog.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({ data: null }),
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- share-dialog.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
vi.mock("@/components/upgrade-cta/login-prompt", () => ({
  LoginPrompt: () => null,
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

const flushReact = async (update: () => void): Promise<void> => {
  await act(async () => {
    update();
    await Promise.resolve();
  });
};

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/promise-function-async, typescript/strict-void-return -- share-dialog.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

test("share link confirms a completed copy and reports clipboard rejection", async () => {
  const copy = Promise.withResolvers<undefined>();
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
    await flushReact(() =>
      root.render(
        <>
          <ShareDialog
            onOpenChange={vi.fn()}
            open
            renderContent={(onClose): React.JSX.Element => (
              <ShareDialogView
                chatId="clipboard-fixture"
                isPending={false}
                isPublic
                onClose={onClose}
                setVisibility={() => Promise.resolve()}
              />
            )}
          />
          <Toaster position="top-center" theme="dark" />
        </>
      )
    );
    await page.getByRole("button", { name: "Get Link" }).click();
    await page.getByRole("button", { exact: true, name: "Copy" }).click();

    expect(clipboard).toHaveBeenCalledWith(
      `${globalThis.location.origin}/share/clipboard-fixture`
    );
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();

    await flushReact(() => copy.resolve(undefined));
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
    await takeSnapshot("share-dialog-clipboard-failure");
  } finally {
    await flushReact(() => root.unmount());
    toast.dismiss();
    container.remove();
    vi.restoreAllMocks();
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/promise-function-async, typescript/strict-void-return */
