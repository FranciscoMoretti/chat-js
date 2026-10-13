import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";

class CopyBoundary extends React.Component<
  { readonly children: React.ReactNode },
  { readonly failed: boolean }
> {
  public constructor(props: { readonly children: ReadonlyReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }
  public override render(): React.ReactNode {
    if (this.state.failed) {
      return <p role="alert">Copy callback failed.</p>;
    }
    return this.props.children;
  }
}

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
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(callbackError);
    });
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
          get(target: ReadonlyNativeSurface<Navigator>, key): unknown {
            if (key === "clipboard") {
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
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledOnce();
      });
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
