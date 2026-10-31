import React, { act, useState } from "react";
import { useAttachmentPicker } from "@/hooks/use-attachment-picker";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { useAttachmentUploads } from "@/plugins/attachment-uploads/integration";
import { renderRoot, unmountRoot } from "./primitive-mount";
import "./sandbox.css";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), signedIn: true }));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: mocks.signedIn ? { user: { id: "fixture" } } : null,
  }),
}));
vi.mock("@/plugins/attachment-uploads/upload", () => ({
  uploadAttachment: mocks.upload,
}));
vi.mock("@/plugins/attachment-uploads/upload-prep", () => ({
  processFilesForUpload: async (files: readonly File[]) =>
    await Promise.resolve({ files, stillOversized: [], unsupportedFiles: [] }),
}));

const file = new File(["fixture"], "notes.pdf", { type: "application/pdf" });

test.each([false, true])(
  "file drops prevent navigation when disabled=%s",
  async (disabled) => {
    const onFiles = vi.fn(async () => {
      await Promise.resolve();
    });
    const Picker = () => {
      const picker = useAttachmentPicker({ disabled, onFiles });
      return (
        <div {...picker.rootProps} data-testid="drop-target">
          <input {...picker.inputProps} />
          {disabled ? "Uploads disabled" : "Drop files here"}
        </div>
      );
    };
    const container = document.createElement("main");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await renderRoot(root, <Picker />);
      const target = container.querySelector('[data-testid="drop-target"]');
      if (!target) {
        throw new Error("Missing drop target");
      }
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const drag = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(drag);
      expect(drag.defaultPrevented).toBe(true);
      const drop = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      await act(async () => {
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(drop.defaultPrevented).toBe(true);
      expect(onFiles).toHaveBeenCalledTimes(disabled ? 0 : 1);
      if (!disabled) {
        expect(onFiles).toHaveBeenCalledWith([file]);
      }
      await takeSnapshot(
        disabled ? "disabled-upload-picker" : "enabled-upload-picker"
      );
    } finally {
      await unmountRoot(root);
      container.remove();
    }
  }
);

const Form = () => {
  const [count, setCount] = useState(0);
  const files = useAttachmentUploads({
    attachmentCount: count,
    onUploaded: () => {
      setCount((value) => value + 1);
    },
  });
  return (
    <section
      aria-label="Project attachments"
      className="space-y-3 rounded border p-6"
    >
      <h1>Project attachments</h1>
      <button
        type="button"
        onClick={() => {
          void files.enqueue([file]);
        }}
      >
        Upload note
      </button>
      <button
        type="button"
        onClick={() => {
          void files.enqueue(Array.from({ length: 17 }, () => file));
        }}
      >
        Upload too many
      </button>
      <p>{files.busy ? "Uploading…" : "Ready"}</p>
      <p>{count} attached</p>
      <output>{files.uploadQueue.join(", ")}</output>
      {files.errors.map((error) => (
        <p role="alert" key={error}>
          {error}
        </p>
      ))}
    </section>
  );
};

test("uploads work in an independent form with queue locking, limits, errors and retry", async () => {
  const deferred = Promise.withResolvers<object>();
  mocks.upload.mockReset().mockReturnValueOnce(deferred.promise);
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;width:650px;background:#171717";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await renderRoot(root, <Form />);
    await page
      .getByRole("button", { name: "Upload note", exact: true })
      .click();
    await expect.element(page.getByText("Uploading…")).toBeVisible();
    await page
      .getByRole("button", { name: "Upload note", exact: true })
      .click();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    deferred.resolve({ name: "notes.pdf" });
    await expect.element(page.getByText("1 attached")).toBeVisible();
    await page.getByRole("button", { name: "Upload too many" }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Attach at most 16 files");
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    mocks.upload.mockRejectedValueOnce(new Error("Storage unavailable"));
    await page
      .getByRole("button", { name: "Upload note", exact: true })
      .click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Storage unavailable");
    await expect
      .element(page.getByText("Ready", { exact: true }))
      .toBeVisible();
    await takeSnapshot("headless-upload-form-error");
    mocks.upload.mockResolvedValueOnce({ name: "notes.pdf" });
    await page
      .getByRole("button", { name: "Upload note", exact: true })
      .click();
    await expect.element(page.getByText("2 attached")).toBeVisible();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    mocks.signedIn = false;
    await renderRoot(root, <Form />);
    await page
      .getByRole("button", { name: "Upload note", exact: true })
      .click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Sign in to attach files");
    expect(mocks.upload).toHaveBeenCalledTimes(3);
  } finally {
    mocks.signedIn = true;
    deferred.resolve({ name: "notes.pdf" });
    await unmountRoot(root);
    container.remove();
  }
});
