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
    await expect.element(page.getByRole("tooltip")).toBeVisible();
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

const readProgressTransforms = (
  container: Readonly<Pick<HTMLElement, "querySelectorAll">>
): readonly string[] => {
  const transforms: string[] = [];
  for (const indicator of container.querySelectorAll<HTMLElement>(
    '[data-testid="progress-states"] [data-slot="progress-indicator"]'
  )) {
    transforms.push(indicator.style.transform);
  }
  return transforms;
};

test("progress states preserve numeric fallbacks and updates", async () => {
  const fixture = await mount(
    <UiPrimitivesVisualFixture includeProgress progressValue={25} />
  );
  try {
    expect(readProgressTransforms(fixture.container)).toEqual([
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(0%)",
      "translateX(-110%)",
      "",
      "translateX(-75%)",
    ]);
    await takeSnapshot("primitives-progress-initial");

    await renderRoot(
      fixture.root,
      <UiPrimitivesVisualFixture includeProgress progressValue={75} />
    );
    expect(readProgressTransforms(fixture.container)).toEqual([
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(-100%)",
      "translateX(0%)",
      "translateX(-110%)",
      "",
      "translateX(-25%)",
    ]);
    await takeSnapshot("primitives-progress-updated");
  } finally {
    await unmount(fixture);
  }
});
