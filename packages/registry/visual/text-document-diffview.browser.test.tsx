import { renderRoot, unmountRoot } from "@/tests/visual/primitive-mount";
import "../../../apps/chat/app/globals.css";
import React from "react";
import { expect, test } from "vitest";
import { DiffView } from "../src/tools/text-documents/diffview";
import { createRoot } from "react-dom/client";
import { takeSnapshot } from "@uiverify/vitest";

test("text document comparison renders unchanged, removed, and added words", async (): Promise<void> => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;background:#171717;width:900px;color:white";
  document.body.append(container);
  const root = createRoot(container);

  try {
    await renderRoot(
      root,
      <DiffView
        newContent="Keep the current rules. Add new wording."
        oldContent="Keep the current rules. Remove old wording."
      />
    );

    await expect
      .poll(() => container.textContent)
      .toContain("Keep the current rules.");
    await expect.poll(() => container.textContent).toContain("Add new");
    const removedText = container.querySelector(".bg-red-100");
    if (!(removedText instanceof HTMLElement)) {
      throw new Error("Removed text was not rendered with its diff style.");
    }
    expect(removedText.textContent).toBe("Remove old");
    const addedText = container.querySelector(".bg-green-100");
    if (!(addedText instanceof HTMLElement)) {
      throw new Error("Added text was not rendered with its diff style.");
    }
    expect(addedText.textContent).toBe("Add new");
    await takeSnapshot("text-document-diffview");
  } finally {
    await unmountRoot(root);
    container.remove();
  }
});
