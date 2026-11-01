import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

import type * as InputGroupModule from "@/components/ui/input-group";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import { mount, unmount } from "./primitive-mount";
import "./composer-native-style.css";

// Exercise the checked-in native Nova InputGroup, whose disabled-child styling
// differs from Rhea. The composer and its submission guard remain the real app.
vi.mock("@/components/ui/input-group", async (importOriginal) => {
  const original = await importOriginal<typeof InputGroupModule>();
  const { InputGroup } =
    await import("../../../site/components/create-preview/ui/base/input-group");
  return { ...original, InputGroup };
});

test("native Nova keeps an editable empty composer opaque without enabling Send", async () => {
  const handleSubmit = vi.fn<() => void>();
  const handleDraftChange = vi.fn<(draft: string) => void>();
  const states = [
    { label: "Editable", disabled: false, readOnly: false },
    { label: "Disabled", disabled: true, readOnly: true },
    { label: "Read only", disabled: false, readOnly: true },
  ];
  const fixture = await mount(
    <main className="style-nova grid max-w-xl gap-8 p-6">
      {states.map(({ label, disabled, readOnly }) => (
        <section aria-label={label} key={label}>
          <h2>{label}</h2>
          <ControlledChatComposer
            draft=""
            disabled={disabled}
            readOnly={readOnly}
            onDraftChange={handleDraftChange}
            onSubmit={handleSubmit}
          />
        </section>
      ))}
    </main>
  );
  try {
    await Promise.all(
      states.map(
        async ({ label }) =>
          await expect
            .element(
              page
                .getByRole("region", { name: label })
                .getByRole("button", { name: "Send" })
            )
            .toBeDisabled()
      )
    );
    const groups = fixture.container.querySelectorAll(
      '[data-slot="input-group"]'
    );
    expect(
      Array.from(groups, (group) => getComputedStyle(group).opacity)
    ).toEqual(["1", "0.5", "0.5"]);
    await expect
      .element(
        page
          .getByRole("region", { name: "Editable" })
          .getByRole("textbox", { name: "Message" })
      )
      .toHaveAttribute("contenteditable", "true");
    expect(
      Array.from(
        fixture.container.querySelectorAll("[contenteditable]"),
        (editor) => editor.getAttribute("contenteditable")
      )
    ).toEqual(["true", "false", "false"]);
    fixture.container.querySelector("form")?.requestSubmit();
    expect(handleSubmit).not.toHaveBeenCalled();
    await takeSnapshot("native-nova-composer-editability");
    await page
      .elementLocator(document.body)
      .screenshot({ path: "__screenshots__/native-nova-composer.png" });
  } finally {
    await unmount(fixture);
  }
});
