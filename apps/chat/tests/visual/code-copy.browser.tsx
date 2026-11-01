import { disableAutoSnapshot, takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { CodeSnippet } from "@/components/code-snippet";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

test("native code copy uses the exact source and announces success", async () => {
  const source = "first line\n\nlast line\n";
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  const fixture = await mount(<CodeSnippet code={source} language="text" />);
  try {
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    expect(clipboard).toHaveBeenCalledWith(source);
    await expect
      .element(page.getByRole("button", { name: "Copied", exact: true }))
      .toBeVisible();
    // Archives do not retain pointer hover; freeze the visible native actions state.
    const hover = document.createElement("style");
    hover.textContent =
      '[data-slot="code-block-actions"] { opacity: 1 !important; }';
    fixture.container.append(hover);
    await takeSnapshot("code-copy-success");
    await expect
      .element(page.getByRole("button", { name: "Copy", exact: true }))
      .toBeVisible();
  } finally {
    clipboard.mockRestore();
    await unmount(fixture);
  }
});

test("clipboard rejection leaves native copy retryable", async () => {
  disableAutoSnapshot();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValue(new Error("Permission denied"));
  const fixture = await mount(<CodeSnippet code="retry" language="text" />);
  try {
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    expect(clipboard).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole("button", { name: "Copy", exact: true }))
      .toBeVisible();
    clipboard.mockResolvedValue();
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect
      .element(page.getByRole("button", { name: "Copied", exact: true }))
      .toBeVisible();
  } finally {
    clipboard.mockRestore();
    await unmount(fixture);
  }
});
