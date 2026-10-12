import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { PromptInputTabLabel } from "@/components/ai-elements/prompt-input";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "./sandbox.css";

test("prompt input heading renders accessible children and forwards native props", async () => {
  let wasClicked = false;
  const onHeadingClick = (): void => {
    wasClicked = true;
  };
  const fixture = await mount(
    <section className="bg-card mx-auto w-full max-w-xl rounded-xl border p-5">
      <PromptInputTabLabel
        aria-describedby="prompt-context-description"
        data-testid="prompt-context-heading"
        id="prompt-context-heading"
        onClick={onHeadingClick}
      >
        Prompt context
      </PromptInputTabLabel>
      <p
        className="text-muted-foreground px-3 text-sm"
        id="prompt-context-description"
      >
        Sources included with the prompt.
      </p>
    </section>
  );

  try {
    const heading = page.getByRole("heading", {
      level: 3,
      name: "Prompt context",
    });
    await expect.element(heading).toBeVisible();
    const headingElement = fixture.container.querySelector("h3");
    if (!headingElement) {
      throw new Error("PromptInputTabLabel did not render an h3 element.");
    }
    expect(headingElement.id).toBe("prompt-context-heading");
    expect(headingElement.getAttribute("aria-describedby")).toBe(
      "prompt-context-description"
    );
    expect(headingElement.dataset.testid).toBe("prompt-context-heading");
    await takeSnapshot("prompt-input-heading-with-description");

    await act(async () => {
      await heading.click();
    });
    expect(wasClicked).toBe(true);
  } finally {
    await unmount(fixture);
  }
});
