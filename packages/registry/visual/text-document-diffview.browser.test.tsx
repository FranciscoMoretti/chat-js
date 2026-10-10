/* oxlint-disable import/no-relative-parent-imports -- The app global stylesheet supplies the registry visual fixture's Tailwind classes. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable import/no-relative-parent-imports */
import React, { act } from "react";
import { expect, test } from "vitest";
/* oxlint-disable import/no-relative-parent-imports -- This relative import connects a package-local renderer and remains valid in the published standalone layout. */
import { DiffView } from "../src/tools/text-documents/diffview";
/* oxlint-enable import/no-relative-parent-imports */
import { createRoot } from "react-dom/client";
import { takeSnapshot } from "@uiverify/vitest";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited render and cleanup sequencing. */
/* oxlint-disable eslint/max-statements -- Keep the fixture setup, assertions, capture, and cleanup together. */
test("text document comparison renders unchanged, removed, and added words", async (): Promise<void> => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;background:#171717;width:900px;color:white";
  document.body.append(container);
  const root = createRoot(container);

  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush Lexical's queued editor update before assertions and capture.
    await act((): void =>
      root.render(
        <DiffView
          newContent="Keep the current rules. Add new wording."
          oldContent="Keep the current rules. Remove old wording."
        />
      )
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush component cleanup before removing its container.
    await act((): void => root.unmount());
    container.remove();
  }
});
/* oxlint-enable eslint/max-statements */
/* oxlint-enable oxc/no-async-await */
