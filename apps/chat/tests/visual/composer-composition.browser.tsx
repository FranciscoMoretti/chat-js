import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { EveComposer } from "@/components/eve/eve-composer";
import { NewConversationView } from "@/components/eve/new-conversation-view";
import { Button } from "@/components/ui/button";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "@/tests/visual/sandbox.css";

const send = vi.fn<() => Promise<void>>();
const retry = vi.fn<() => void>();
const changeDraft = vi.fn<(value: string) => void>();

// The presentation seams must work without a saved creation request or an account runtime.
// A picker supplied by a caller does not mount the default model provider.
vi.mock("@/components/eve/eve-model-picker", () => ({
  EveModelPicker: () => {
    throw new Error("Custom picker was replaced by the default picker");
  },
}));

test("custom composer selection inherits locks and submission owns recovery", async () => {
  const fixture = await mount(
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {[false, true].map((locked) => (
        <EveComposer
          key={String(locked)}
          disabled={locked}
          draft="Write a response"
          onDraftChange={changeDraft}
          onSubmit={() => {
            void send();
          }}
          modelPicker={
            <Button type="button">
              {locked ? "Locked selection" : "Custom selection"}
            </Button>
          }
        />
      ))}
      <EveComposer
        disabled={false}
        readOnly
        draft="Retained request"
        onDraftChange={changeDraft}
        onSubmit={() => {
          void send();
        }}
        modelPicker={<Button type="button">Retained selection</Button>}
      />
      <NewConversationView
        contextual={false}
        composer={
          <p>This composer must stay hidden until recovery completes</p>
        }
        submission={{
          submit: send,
          pending: false,
          recovery: (
            <section aria-label="Custom recovery">
              <p>The submission owns the retained request.</p>
              <Button onClick={retry}>Recover custom request</Button>
            </section>
          ),
        }}
      />
    </main>
  );
  try {
    await expect
      .element(
        page.getByRole("button", { name: "Custom selection", exact: true })
      )
      .toBeEnabled();
    await expect
      .element(page.getByRole("button", { name: "Locked selection" }))
      .toBeDisabled();
    await expect
      .element(page.getByRole("button", { name: "Retained selection" }))
      .toBeDisabled();
    await expect
      .element(
        page.getByText(
          "This composer must stay hidden until recovery completes"
        )
      )
      .not.toBeInTheDocument();
    await page.getByRole("button", { name: "Recover custom request" }).click();
    expect(retry).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    await takeSnapshot("composer-custom-selection-and-recovery");
  } finally {
    await unmount(fixture);
  }
});
