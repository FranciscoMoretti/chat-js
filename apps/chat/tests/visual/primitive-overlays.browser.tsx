import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable eslint/sort-imports -- Preserve pinned Oxfmt declaration ordering and runtime module evaluation order. */
import React, { act } from "react";
/* oxlint-enable eslint/sort-imports */
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { LayoutPrimitivesVisualFixture } from "@/components/ui/layout-primitives-visual-fixture";
import { UiPrimitivesVisualFixture } from "@/components/ui/ui-primitives-visual-fixture";

/* oxlint-disable eslint/sort-imports -- Preserve pinned Oxfmt declaration ordering and runtime module evaluation order. */
import { mount, unmount } from "./primitive-mount";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Preserve pinned Oxfmt declaration ordering and runtime module evaluation order. */
import "./sandbox.css";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements, oxc/no-async-await, typescript/promise-function-async -- eslint/max-statements: Keep this ordered browser interaction and its cleanup in one observable scenario; oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; typescript/promise-function-async: Return the browser interaction promise directly to React act without another async wrapper. */
test("existing primitives preserve anchored overlay states", async () => {
  const fixture = await mount(<UiPrimitivesVisualFixture />);
  try {
    await takeSnapshot("primitives-closed");
    await act(() => page.getByRole("button", { name: "Open popover" }).click());
    await expect.element(page.getByText("Popover content")).toBeVisible();
    await takeSnapshot("primitives-popover");
    await act(() => userEvent.keyboard("{Escape}"));
    await act(() =>
      page.getByRole("button", { name: "Hover tooltip" }).hover()
    );
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    await takeSnapshot("primitives-tooltip");
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable eslint/max-statements, oxc/no-async-await, typescript/promise-function-async */
/* oxlint-disable eslint/max-statements, oxc/no-async-await, typescript/promise-function-async -- eslint/max-statements: Keep this ordered browser interaction and its cleanup in one observable scenario; oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; typescript/promise-function-async: Return the browser interaction promise directly to React act without another async wrapper. */
test("layout primitives preserve alert dialog and sheet portals", async () => {
  let fixture = await mount(<LayoutPrimitivesVisualFixture />);
  try {
    await act(() => page.getByRole("button", { name: "Open alert" }).click());
    await expect.element(page.getByText("Delete project?")).toBeVisible();
    await takeSnapshot("primitives-alert");
    await act(() => page.getByRole("button", { name: "Cancel" }).click());
    await unmount(fixture);
    fixture = await mount(<LayoutPrimitivesVisualFixture />);
    await act(() => page.getByRole("button", { name: "Open dialog" }).click());
    await expect.element(page.getByText("Project settings")).toBeVisible();
    await takeSnapshot("primitives-dialog");
    await act(() =>
      page.getByRole("button", { exact: true, name: "Close" }).click()
    );
    await unmount(fixture);
    fixture = await mount(<LayoutPrimitivesVisualFixture />);
    await act(() => page.getByRole("button", { name: "Open sheet" }).click());
    await expect.element(page.getByText("Inspector")).toBeVisible();
    await takeSnapshot("primitives-sheet");
    await act(() => userEvent.keyboard("{Escape}"));
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable eslint/max-statements, oxc/no-async-await, typescript/promise-function-async */
