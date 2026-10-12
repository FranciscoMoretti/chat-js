import { renderRoot, unmountRoot } from "@/tests/visual/primitive-mount";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { Favicon } from "@/components/favicon";
import { MessageAttachment } from "@/components/ai-elements/message";
import { GenerateImageRenderer } from "../src/tools/generate-image/renderer";
import { ImageModal } from "@/components/image-modal";
import { createRoot } from "react-dom/client";
import { takeSnapshot } from "@uiverify/vitest";
import "../../../apps/chat/tests/visual/sandbox.css";

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
  await renderRoot(
    root,
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
  );
  try {
    await expect
      .poll(() => container.textContent)
      .toContain("Generated image unavailable");
    await expect
      .poll(() => container.querySelector("img")?.complete)
      .toBe(true);
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) {
      throw new Error("Image button missing");
    }
    button.focus();
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
    await page.elementLocator(button).click();
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
    await unmountRoot(root);
    URL.revokeObjectURL(blobUrl);
    container.remove();
    style.remove();
  }
});

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
    await renderRoot(
      root,
      <ImageModal
        imageName="Empty URL fixture"
        imageUrl={url}
        isOpen={isOpen}
        onClose={handleClose}
        showActions={false}
      />
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
    await unmountRoot(root);
    consoleError.mockRestore();
    container.remove();
  }
});
