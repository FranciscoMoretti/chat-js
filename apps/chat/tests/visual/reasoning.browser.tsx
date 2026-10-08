/* oxlint-disable sort-imports -- Preserve Oxfmt's browser-test import and stylesheet grouping. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "./sandbox.css";
/* oxlint-enable sort-imports */

const FIXED_DURATION = 2;

/* oxlint-disable react/jsx-no-literals -- Static reasoning labels and markdown keep the component-state capture deterministic. */
/* oxlint-disable max-lines-per-function, max-statements, oxc/no-async-await, typescript/promise-function-async -- max-lines-per-function/max-statements: Keep the controlled and uncontrolled callback interactions, shared state gallery, capture and cleanup in one scenario; oxc/no-async-await: Await native browser interactions and React commits before checking callback results and capturing; typescript/promise-function-async: Return the browser interaction promise directly to React act. */
test("reasoning preserves standalone callbacks and controlled open state", async () => {
  const uncontrolledChanges: boolean[] = [];
  const controlledChanges: boolean[] = [];
  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop -- This single-mount fixture records uncontrolled notifications without a production render loop.
  const onUncontrolledChange = (open: boolean): void => {
    uncontrolledChanges.push(open);
  };
  // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop -- This single-mount fixture records controlled notifications without a production render loop.
  const onControlledChange = (open: boolean): void => {
    controlledChanges.push(open);
  };
  const fixture = await mount(
    <section className="bg-card mx-auto w-full max-w-xl rounded-xl border p-5">
      <Reasoning defaultOpen={false} onOpenChange={onUncontrolledChange}>
        <ReasoningTrigger>Uncontrolled reasoning</ReasoningTrigger>
        <ReasoningContent>Uncontrolled content.</ReasoningContent>
      </Reasoning>
      <Reasoning
        data-contract="controlled-reasoning"
        defaultOpen={false}
        duration={FIXED_DURATION}
        onOpenChange={onControlledChange}
        open
      >
        <ReasoningTrigger>Controlled reasoning</ReasoningTrigger>
        <ReasoningContent>Controlled content.</ReasoningContent>
      </Reasoning>
      <Reasoning defaultOpen={false} isStreaming open>
        <ReasoningTrigger />
        <ReasoningContent>Streaming content.</ReasoningContent>
      </Reasoning>
    </section>
  );

  try {
    const uncontrolled = page.getByRole("button", {
      exact: true,
      name: "Uncontrolled reasoning",
    });
    const controlled = page.getByRole("button", {
      exact: true,
      name: "Controlled reasoning",
    });
    await expect
      .element(uncontrolled)
      .toHaveAttribute("aria-expanded", "false");
    await act(() => uncontrolled.click());
    await expect.element(uncontrolled).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("Uncontrolled content.")).toBeVisible();
    expect(uncontrolledChanges).toEqual([true]);
    await act(() => uncontrolled.click());
    await expect
      .element(uncontrolled)
      .toHaveAttribute("aria-expanded", "false");
    expect(uncontrolledChanges).toEqual([true, false]);

    await act(() => controlled.click());
    expect(controlledChanges).toEqual([false]);
    await expect.element(controlled).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("Controlled content.")).toBeVisible();
    await expect.element(page.getByText("Thinking...")).toBeVisible();
    const thinkingLabel = page.getByText("Thinking...").element();
    if (!(thinkingLabel instanceof HTMLElement)) {
      throw new Error("The streaming reasoning label did not render.");
    }
    // Freeze the infinite JS shimmer at its initial position for this capture.
    thinkingLabel.dataset.reasoningCapture = "";
    const shimmerStyle = document.createElement("style");
    shimmerStyle.textContent =
      "[data-reasoning-capture] { background-position: 100% center !important; }";
    fixture.container.append(shimmerStyle);
    expect(
      fixture.container.querySelector('[data-contract="controlled-reasoning"]')
    ).toBeTruthy();
    await takeSnapshot("reasoning-controlled-uncontrolled-streaming");
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable max-lines-per-function, max-statements, oxc/no-async-await, typescript/promise-function-async */
/* oxlint-enable react/jsx-no-literals */
