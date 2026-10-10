import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { Favicon } from "@/components/favicon";
import { MessageAttachment } from "@/components/ai-elements/message";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- MessageAttachment loads streamdown/styles.css before GenerateImageRenderer loads ImageModal and Sonner's injected stylesheet; preserve that style insertion order. */
import { GenerateImageRenderer } from "../src/tools/generate-image/renderer";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
import { ImageModal } from "@/components/image-modal";
import { createRoot } from "react-dom/client";
import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- MessageAttachment imports streamdown/styles.css before this fixture stylesheet; preserve the native browser style insertion order. */
import "../../../apps/chat/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
test("image tool loading, success, and unavailable states", async () => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;background:#171717;width:960px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px";
  document.documentElement.classList.add("dark");
  document.body.append(container);
  const style = document.createElement("style");
  style.textContent =
    "* { animation: none !important; transition: none !important; }";
  document.head.append(style);
  const root = createRoot(container);
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, 0, 300, 256);
  const imageUrl = canvas.toDataURL();
  const response = await fetch(imageUrl);
  const imageBlob = await response.blob();
  const blobUrl = URL.createObjectURL(imageBlob);
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act(() =>
    root.render(
      <>
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
          tool={{
            input: { prompt: "Blue sky" },
            state: "input-available",
            toolCallId: "loading",
          }}
        />
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
          tool={{
            input: { prompt: "Blue sky" },
            output: { imageUrl, prompt: "Blue sky" },
            state: "output-available",
            toolCallId: "success",
          }}
        />
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
          tool={{
            input: { prompt: "Unavailable" },
            output: {
              imageUrl: "data:image/png;base64,invalid",
              prompt: "Unavailable",
            },
            state: "output-available",
            toolCallId: "missing",
          }}
        />
        <MessageAttachment
          data={{
            filename: "Data attachment",
            mediaType: "image/png",
            type: "file",
            url: imageUrl,
          }}
        />
        <MessageAttachment
          data={{
            filename: "Blob attachment",
            mediaType: "image/png",
            type: "file",
            url: blobUrl,
          }}
        />
        <Favicon url={imageUrl} srcSet={`${imageUrl} 2x`} width="100%" />
      </>
    )
  );
  try {
    await expect
      .poll(() => container.textContent)
      .toContain("Generated image unavailable");
    await expect
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading complete from container.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      .poll(() => container.querySelector("img")?.complete)
      .toBe(true);
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) {
      throw new Error("Image button missing");
    }
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act(() => button.focus());
    const actions = container.querySelector<HTMLElement>(
      String.raw`.group-focus-within\:opacity-100`
    );
    if (!actions) {
      throw new Error("Image actions missing");
    }
    await expect.poll(() => getComputedStyle(actions).opacity).toBe("1");
    const successImage = container.querySelector<HTMLImageElement>(
      'img[alt="Blue sky"]'
    );
    if (!successImage) {
      throw new Error("Generated image missing");
    }
    expect(successImage.getAttribute("src")).toBe(imageUrl);
    expect(successImage.loading).toBe("eager");
    expect(successImage.getAttribute("srcset")).toBeNull();
    const blobImage = container.querySelector<HTMLImageElement>(
      'img[alt="Blob attachment"]'
    );
    if (!blobImage) {
      throw new Error("Blob attachment missing");
    }
    await expect.poll(() => blobImage.naturalWidth).toBe(300);
    expect(getComputedStyle(blobImage).objectFit).toBe("cover");
    await takeSnapshot("image-tool-states");
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Flush React's native image-preview click before inspecting the mounted dialog.
    await act(() => button.click());
    const modalImage = document.querySelector<HTMLImageElement>(
      '[role="dialog"] img'
    );
    if (!modalImage) {
      throw new Error("Expanded image missing");
    }
    await expect.poll(() => modalImage.naturalWidth).toBe(300);
    expect(modalImage.getBoundingClientRect().width).toBe(300);
    expect(modalImage.getBoundingClientRect().height).toBe(256);
    expect(getComputedStyle(modalImage).objectFit).toBe("contain");
    await takeSnapshot("image-tool-intrinsic-modal");
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act(() => root.unmount());
    URL.revokeObjectURL(blobUrl);
    container.remove();
    style.remove();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable oxc/no-async-await -- Await native image loading and Radix exit cleanup before checking the console and final DOM. */
/* oxlint-disable max-statements, max-lines-per-function -- Exercise the exported modal's ordered empty/open/close/reopen transitions together to preserve one console-error observation window. */
const waitForAnimations = async (): Promise<void> => {
  await act(async () => {
    const completions: Promise<Animation>[] = [];
    for (const animation of document.getAnimations()) {
      completions.push(animation.finished);
    }
    await Promise.all(completions);
  });
};
const modalImageWidth = (): number => {
  const modalImage = document.querySelector<HTMLImageElement>(
    '[role="dialog"] img'
  );
  const unloadedWidth = 0;
  if (!modalImage) {
    return unloadedWidth;
  }
  return modalImage.naturalWidth;
};
test("image modal empty source and close transition stay console-error free", async () => {
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  const consoleError = vi.spyOn(console, "error");
  const imageUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='24'%3E%3Crect width='32' height='24' fill='blue'/%3E%3C/svg%3E";
  const intrinsicWidth = 32;
  const handleClose = vi.fn<() => void>();
  const renderModal = async (isOpen: boolean, url: string): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Flush this controlled React prop transition before inspecting Radix presence.
    await act(() =>
      root.render(
        <ImageModal
          imageName="Empty URL fixture"
          imageUrl={url}
          isOpen={isOpen}
          onClose={handleClose}
          showActions={false}
        />
      )
    );
  };
  try {
    await renderModal(true, imageUrl);
    await waitForAnimations();
    await expect.poll(modalImageWidth).toBe(intrinsicWidth);
    await waitForAnimations();
    await renderModal(false, "");
    expect(
      document.querySelector(
        '[data-slot="dialog-content"][data-state="closed"]'
      )
    ).not.toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    await waitForAnimations();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await renderModal(true, "");
    await waitForAnimations();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] img')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    await takeSnapshot("image-modal-empty-source");
    await renderModal(true, imageUrl);
    await waitForAnimations();
    await expect.poll(modalImageWidth).toBe(intrinsicWidth);
    await renderModal(false, "");
    await waitForAnimations();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Flush Radix portal unmount before restoring the native console spy.
    await act(() => root.unmount());
    consoleError.mockRestore();
    container.remove();
  }
});
/* oxlint-enable max-statements, max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
