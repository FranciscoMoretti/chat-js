import React, { act, useState } from "react";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { takeSnapshot, disableAutoSnapshot } from "@uiverify/vitest";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import { InputGroupButton } from "@/components/ui/input-group";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";
import { composerDraftCases } from "../../../../packages/chat-visual-tests/contracts/composer";

test("app and Create share submission eligibility", async () => {
  disableAutoSnapshot();
  const fixture = await mount(
    <main>
      {composerDraftCases.map(({ name, canSend: _canSend, ...props }) => (
        <section key={name} aria-label={name}>
          <ControlledChatComposer
            {...props}
            disabled={false}
            onDraftChange={vi.fn<(value: string) => void>()}
            onSubmit={vi.fn<() => void>()}
          />
        </section>
      ))}
    </main>
  );
  try {
    await Promise.all(
      composerDraftCases.map(async ({ name, canSend }) => {
        const send = page
          .getByRole("region", { name, exact: true })
          .getByRole("button", { name: "Send", exact: true });
        await (canSend
          ? expect.element(send).toBeEnabled()
          : expect.element(send).toBeDisabled());
      })
    );
  } finally {
    await unmount(fixture);
  }
});

const DraftComposer = ({
  onSubmit,
  onPaste,
}: {
  readonly onSubmit: () => void;
  readonly onPaste: () => void;
}) => {
  const [draft, setDraft] = useState("Restored draft");
  return (
    <ControlledChatComposer
      draft={draft}
      disabled={false}
      onDraftChange={setDraft}
      onSubmit={onSubmit}
      onPaste={onPaste}
    />
  );
};

test("native form retains restored text, IME, desktop and mobile keyboard policy, and paste", async () => {
  // The state gallery below covers presentation; this case checks keyboard behavior.
  disableAutoSnapshot();
  const submit = vi.fn<() => void>();
  const paste = vi.fn<() => void>();
  await page.viewport(1000, 900);
  const fixture = await mount(
    <DraftComposer onSubmit={submit} onPaste={paste} />
  );
  try {
    const editor = page.getByRole("textbox", { name: "Message" });
    await expect.element(editor).toHaveTextContent("Restored draft");
    await expect
      .element(editor)
      .toHaveAttribute("data-slot", "input-group-control");
    await editor.click();
    act(() => {
      editor.element().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: true,
        })
      );
    });
    expect(submit).not.toHaveBeenCalled();
    await act(async () => {
      await editor.fill("Edited draft");
    });
    await act(async () => {
      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    });
    expect(submit).not.toHaveBeenCalled();
    await act(async () => {
      await userEvent.keyboard("{Enter}");
    });
    expect(submit).toHaveBeenCalledOnce();
    act(() => {
      editor
        .element()
        .dispatchEvent(
          new ClipboardEvent("paste", { bubbles: true, cancelable: true })
        );
    });
    expect(paste).toHaveBeenCalledOnce();
    await act(async () => {
      await page.viewport(390, 844);
    });
    await expect.element(editor).toHaveTextContent("Edited draft");
    await act(async () => {
      await userEvent.keyboard("{Enter}");
    });
    expect(submit).toHaveBeenCalledOnce();
    await act(async () => {
      await userEvent.keyboard("{Control>}{Enter}{/Control}");
    });
    expect(submit).toHaveBeenCalledTimes(2);
  } finally {
    await unmount(fixture);
  }
});

test("submission guards cover read-only, uploads, length and busy states while cancellation stays separate", async () => {
  const submit = vi.fn<() => void>();
  const stop = vi.fn<() => void>();
  const draftChange = vi.fn<(draft: string) => void>();
  await page.viewport(1100, 1200);
  const states = [
    { name: "Ready", draft: "Ready to send" },
    { name: "Read only", draft: "Retained draft", readOnly: true },
    { name: "Uploading", draft: "Upload in progress", disabled: true },
    { name: "Attachment only", draft: "", hasAttachments: true },
    { name: "Too long", draft: "x".repeat(16_001) },
    {
      name: "Submitted",
      draft: "Next draft",
      status: "submitted",
      onStop: stop,
    },
    {
      name: "Streaming",
      draft: "Next draft",
      status: "streaming",
      onStop: stop,
    },
    {
      name: "Stopping",
      draft: "",
      status: "streaming",
      onStop: stop,
      stopDisabled: true,
    },
  ] satisfies (Partial<React.ComponentProps<typeof ControlledChatComposer>> & {
    name: string;
    draft: string;
  })[];
  const fixture = await mount(
    <main className="grid grid-cols-2 gap-6 p-4">
      {states.map(({ name, ...props }) => (
        <section key={name} aria-label={name}>
          <h2>{name}</h2>
          <ControlledChatComposer
            disabled={false}
            onSubmit={submit}
            onDraftChange={draftChange}
            tools={<InputGroupButton size="sm">Model</InputGroupButton>}
            {...props}
          />
        </section>
      ))}
    </main>
  );
  try {
    await Promise.all(
      ["Read only", "Uploading", "Too long"].map(async (name) => {
        await expect
          .element(
            page
              .getByRole("region", { name, exact: true })
              .getByRole("button", { name: "Send", exact: true })
          )
          .toBeDisabled();
      })
    );
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Messages must be at most 16,000 characters.");
    for (const form of fixture.container.querySelectorAll("form")) {
      act(() => {
        form.requestSubmit();
      });
    }
    expect(submit).toHaveBeenCalledTimes(2);
    await page
      .getByRole("region", { name: "Submitted", exact: true })
      .getByRole("button", { name: "Stop", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Streaming", exact: true })
      .getByRole("button", { name: "Stop", exact: true })
      .click();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(2);
    await expect
      .element(
        page
          .getByRole("region", { name: "Stopping", exact: true })
          .getByRole("button", { name: "Stop", exact: true })
      )
      .toBeDisabled();
    window.scrollTo(0, 0);
    await takeSnapshot("native-prompt-form-states");
    await page
      .elementLocator(document.body)
      .screenshot({ path: "__screenshots__/native-prompt-form-states.png" });
  } finally {
    await unmount(fixture);
  }
});
