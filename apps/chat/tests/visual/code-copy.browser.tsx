/* oxlint-disable sort-imports -- Oxfmt's module grouping conflicts with sort-imports binding-syntax ordering. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

class CopyBoundary extends React.Component<
  { readonly children: React.ReactNode },
  { readonly failed: boolean }
> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ReactNode retains its native element/portal contract; this boundary forwards it without mutation.
  public constructor(props: CopyBoundary["props"]) {
    super(props);
    this.state = { failed: false };
  }
  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }
  public override render(): React.ReactNode {
    if (this.state.failed) {
      // oxlint-disable-next-line react/jsx-no-literals -- The boundary renders fixed accessible fixture copy without a translation API.
      return <p role="alert">Copy callback failed.</p>;
    }
    return this.props.children;
  }
}

/* oxlint-disable oxc/no-async-await -- Await clipboard completion, consumer callbacks, React commits and fixture cleanup. */
/* oxlint-disable max-statements -- This scenario verifies the clipboard, asynchronous consumer rejection and copied-indicator timeout together. */
test("async copy failures reach onError and still reset the copied indicator", async () => {
  const callbackError = new Error("Copy consumer failed");
  const onCopy = vi.fn<() => Promise<void>>().mockRejectedValue(callbackError);
  const onError = vi
    .fn<(error: Readonly<Error>) => Promise<void>>()
    .mockResolvedValue();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  const resetDelay = 100;
  const fixture = await mount(
    <CodeBlockCopyButton
      aria-label="Copy code"
      onCopy={onCopy}
      onError={onError}
      timeout={resetDelay}
    />
  );
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Copy code" }).click();
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(callbackError));
    expect(clipboard).toHaveBeenCalledOnce();
    await expect
      .poll(() =>
        page
          .getByRole("button", { name: "Copy code" })
          .element()
          .querySelector(".lucide-copy")
      )
      .not.toBeNull();
    await takeSnapshot("code-copy-callback-failure-reset");
    await page.getByRole("button", { name: "Copy code" }).screenshot();
  } finally {
    clipboard.mockRestore();
    await unmount(fixture);
  }
});
/* oxlint-enable max-statements */

/* oxlint-disable max-statements -- One callback ownership scenario verifies API failure, deferred error completion and its React boundary. */
test.each(["clipboard", "unavailable"])(
  "%s failures await onError and reach the React boundary if it rejects",
  async (mode) => {
    const callback = Promise.withResolvers<undefined>();
    const onError = vi
      .fn<(error: Readonly<Error>) => Promise<void>>()
      .mockReturnValue(callback.promise);
    const originalNavigator = navigator;
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error("Clipboard failed"));
    if (mode === "unavailable") {
      vi.stubGlobal(
        "navigator",
        new Proxy(originalNavigator, {
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve Navigator native accessors on the original receiver; the proxy reads without mutation.
          get(target, key): unknown {
            if (key === "clipboard") {
              // oxlint-disable-next-line no-undefined -- Simulate an absent browser Clipboard API.
              return undefined;
            }
            return Reflect.get(target, key, target);
          },
        })
      );
    } else {
      vi.spyOn(originalNavigator.clipboard, "writeText").mockImplementation(
        writeText
      );
    }
    const fixture = await mount(
      <CopyBoundary>
        <CodeBlockCopyButton aria-label="Copy code" onError={onError} />
      </CopyBoundary>
    );
    try {
      await act(async () => {
        await page.getByRole("button", { name: "Copy code" }).click();
      });
      await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
      await act(async () => {
        callback.reject(new Error("Error consumer failed"));
        await Promise.resolve();
      });
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Copy callback failed.");
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      await unmount(fixture);
    }
  }
);
/* oxlint-enable oxc/no-async-await */

/* oxlint-enable max-statements */
