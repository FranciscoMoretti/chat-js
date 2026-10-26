import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { mount, renderRoot, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

test("reasoning completes once and remains manually expandable after a stream", async () => {
  const fixture = await mount(
    <ReasoningPart content="The evidence supports" isLoading />
  );
  try {
    const trigger = page.getByTestId("message-reasoning-toggle");
    await expect.element(trigger).toHaveTextContent("Thinking...");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await renderRoot(
      fixture.root,
      <ReasoningPart
        content="The evidence supports the result."
        isLoading={false}
      />
    );
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect
      .element(page.getByTestId("message-reasoning"))
      .toHaveTextContent("The evidence supports the result.");
    await renderRoot(
      fixture.root,
      <ReasoningPart
        content="The evidence supports the result. More detail."
        isLoading={false}
      />
    );
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await takeSnapshot("reasoning-controlled-uncontrolled-streaming");
  } finally {
    await unmount(fixture);
  }
});
