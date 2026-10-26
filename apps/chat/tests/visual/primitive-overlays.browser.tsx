import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { LayoutPrimitivesVisualFixture } from "@/components/ui/layout-primitives-visual-fixture";
import { UiPrimitivesVisualFixture } from "@/components/ui/ui-primitives-visual-fixture";

import { mount, renderRoot, unmount } from "./primitive-mount";

import "./sandbox.css";

test("existing primitives preserve anchored overlay states", async () => {
  const fixture = await mount(<UiPrimitivesVisualFixture />);
  try {
    await takeSnapshot("primitives-closed");
    await act(async () => {
      await page.getByRole("button", { name: "Open popover" }).click();
    });
    await expect.element(page.getByText("Popover content")).toBeVisible();
    await takeSnapshot("primitives-popover");
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    await act(async () => {
      await page.getByRole("button", { name: "Hover tooltip" }).hover();
    });
    await expect
      .element(page.getByText("Tooltip content", { exact: true }))
      .toBeVisible();
    await takeSnapshot("primitives-tooltip");
  } finally {
    await unmount(fixture);
  }
});

test("layout primitives preserve alert dialog and sheet portals", async () => {
  let fixture = await mount(<LayoutPrimitivesVisualFixture />);
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Open alert" }).click();
    });
    await expect.element(page.getByText("Delete project?")).toBeVisible();
    await takeSnapshot("primitives-alert");
    await act(async () => {
      await page.getByRole("button", { name: "Cancel" }).click();
    });
    await unmount(fixture);
    fixture = await mount(<LayoutPrimitivesVisualFixture />);
    await act(async () => {
      await page.getByRole("button", { name: "Open dialog" }).click();
    });
    await expect.element(page.getByText("Project settings")).toBeVisible();
    await takeSnapshot("primitives-dialog");
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Close" }).click();
    });
    await unmount(fixture);
    fixture = await mount(<LayoutPrimitivesVisualFixture />);
    await act(async () => {
      await page.getByRole("button", { name: "Open sheet" }).click();
    });
    await expect.element(page.getByText("Inspector")).toBeVisible();
    await takeSnapshot("primitives-sheet");
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
  } finally {
    await unmount(fixture);
  }
});

test("progress exposes indeterminate and changing completion values", async () => {
  const fixture = await mount(
    <UiPrimitivesVisualFixture includeProgress progressValue={25} />
  );
  try {
    await expect
      .element(page.getByRole("progressbar", { name: "Indeterminate" }))
      .not.toHaveAttribute("aria-valuenow");
    await expect
      .element(page.getByRole("progressbar", { name: "Zero" }))
      .toHaveAttribute("aria-valuenow", "0");
    await expect
      .element(page.getByRole("progressbar", { name: "Complete" }))
      .toHaveAttribute("aria-valuenow", "100");
    await expect
      .element(page.getByRole("progressbar", { name: "Updating" }))
      .toHaveAttribute("aria-valuenow", "25");
    await takeSnapshot("primitives-progress-initial");
    await renderRoot(
      fixture.root,
      <UiPrimitivesVisualFixture includeProgress progressValue={75} />
    );
    await expect
      .element(page.getByRole("progressbar", { name: "Updating" }))
      .toHaveAttribute("aria-valuenow", "75");
    await takeSnapshot("primitives-progress-updated");
  } finally {
    await unmount(fixture);
  }
});
