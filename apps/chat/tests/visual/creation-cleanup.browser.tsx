/* oxlint-disable react/jsx-no-literals -- Fixed fixture labels and expected recovery copy form the accessible browser scenario; no translation API exists in the fixture. */
/* oxlint-disable max-statements, max-lines-per-function -- This integration scenario keeps the rejected request, visible recovery and storage-only retry assertions in one lifecycle. */
/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import type { ComponentProps } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { EveComposer } from "@/components/eve/eve-composer";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

const runtime = vi.hoisted(() => ({
  open: vi.fn(),
  resolve: vi.fn(),
  setAttachments: vi.fn(),
}));
vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: runtime.resolve,
}));
vi.mock("@/components/eve/eve-logical-context", () => ({
  useEveRuntime: (): typeof runtime.open => runtime.open,
}));
vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: (): string => "openai/gpt-4.1",
  useModelChange: (): ReturnType<typeof vi.fn> => vi.fn(),
}));
vi.mock("@/components/eve/use-eve-attachments", () => ({
  useEveAttachments: (): {
    readonly attachments: never[];
    readonly setAttachments: ReturnType<typeof vi.fn>;
  } => ({ attachments: [], setAttachments: runtime.setAttachments }),
}));
vi.mock("next/navigation", () => ({
  useRouter: (): { readonly refresh: ReturnType<typeof vi.fn> } => ({
    refresh: vi.fn(),
  }),
}));
vi.mock("@/components/eve/eve-initial-message", () => ({
  EveInitialMessage: (): React.JSX.Element => <p>Creating conversation…</p>,
}));
vi.mock("@/components/eve/eve-composer", () => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The native composer props contain React dispatchers and mutable upload collections; this fixture invokes their callbacks without mutation.
  EveComposer: ({
    draft,
    onDraftChange,
    onSubmit,
  }: Readonly<ComponentProps<typeof EveComposer>>): React.JSX.Element => (
    <section>
      <input
        aria-label="Message"
        value={draft}
        onInput={(event: {
          readonly currentTarget: { readonly value: string };
        }) => onDraftChange(event.currentTarget.value)}
      />
      <button
        type="button"
        onClick={() => {
          onSubmit();
        }}
      >
        Send
      </button>
    </section>
  ),
}));

test("creation cleanup warning survives the recovery handoff without resending a rejected request", async () => {
  sessionStorage.clear();
  runtime.resolve.mockRejectedValue(
    new CreationRejectedError("Creation rejected")
  );
  const removal = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
  const fixture = await mount(
    <NewEveConversation
      ownerId="test-owner"
      projectId="11111111-1111-4111-8111-111111111111"
    />
  );
  try {
    await page
      .getByRole("textbox", { name: "Message" })
      .fill("Keep this draft");
    await page.getByRole("button", { name: "Send" }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent(
        "The rejected request could not be cleared. Keep this tab for recovery."
      );
    await expect
      .element(page.getByRole("button", { name: "Clear rejected request" }))
      .toBeEnabled();
    await expect
      .element(page.getByRole("button", { name: "Retry creation" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Continue without project" }))
      .not.toBeInTheDocument();
    await takeSnapshot("creation-rejected-cleanup");
    await page
      .getByRole("region", { name: "Conversation recovery" })
      .screenshot();
    removal.mockRestore();
    await page.getByRole("button", { name: "Clear rejected request" }).click();
    await expect
      .element(page.getByRole("textbox", { name: "Message" }))
      .toHaveValue("Keep this draft");
    expect(runtime.resolve).toHaveBeenCalledOnce();
    expect(runtime.open).not.toHaveBeenCalled();
  } finally {
    removal.mockRestore();
    sessionStorage.clear();
    await unmount(fixture);
  }
});

/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, max-lines-per-function */
/* oxlint-enable react/jsx-no-literals */
