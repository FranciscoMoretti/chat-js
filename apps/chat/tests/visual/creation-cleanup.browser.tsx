import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { EveComposer } from "@/components/eve/eve-composer";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import {
  prepareResponseGroupCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";

const runtime = vi.hoisted(() => ({
  open: vi.fn(),
  resolve: vi.fn(),
  setAttachments: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
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
  EveComposer: ({
    disabled,
    draft,
    onDraftChange,
    onSubmit,
  }: Readonly<
    Pick<
      ComponentProps<typeof EveComposer>,
      "disabled" | "draft" | "onDraftChange" | "onSubmit"
    >
  >): React.JSX.Element => (
    <section>
      <input
        aria-label="Message"
        value={draft}
        onInput={(event: {
          readonly currentTarget: { readonly value: string };
        }) => {
          onDraftChange(event.currentTarget.value);
        }}
      />
      <button
        disabled={disabled}
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

test("creation shows progress before a deferred request completes", async () => {
  sessionStorage.clear();
  const pending = Promise.withResolvers<never>();
  runtime.resolve.mockReturnValue(pending.promise);
  const fixture = await mount(<NewEveConversation ownerId="test-owner" />);
  try {
    await act(async () => {
      await page
        .getByRole("textbox", { name: "Message" })
        .fill("Keep this draft");
    });
    await act(async () => {
      await page.getByRole("button", { name: "Send" }).click();
    });
    await expect
      .element(page.getByText("Creating conversation…"))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Send" }))
      .toBeDisabled();
    expect(runtime.resolve).toHaveBeenCalledOnce();
    await takeSnapshot("creation-pending-request");
    await page.getByRole("main").screenshot();
    await act(async () => {
      pending.reject(new CreationRejectedError("Creation rejected"));
      await expect(pending.promise).rejects.toBeInstanceOf(
        CreationRejectedError
      );
    });
    await expect
      .element(page.getByRole("textbox", { name: "Message" }))
      .toHaveValue("Keep this draft");
    await expect
      .element(page.getByRole("button", { name: "Send" }))
      .toBeEnabled();
  } finally {
    await act(async () => {
      pending.reject(new CreationRejectedError("Test cleanup"));
      await expect(pending.promise).rejects.toBeInstanceOf(
        CreationRejectedError
      );
    });
    sessionStorage.clear();
    await unmount(fixture);
  }
});

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
      creationInput={{ projectId: "11111111-1111-4111-8111-111111111111" }}
    />
  );
  try {
    await act(async () => {
      await page
        .getByRole("textbox", { name: "Message" })
        .fill("Keep this draft");
    });
    await act(async () => {
      await page.getByRole("button", { name: "Send" }).click();
    });
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
    await act(async () => {
      await page
        .getByRole("button", { name: "Clear rejected request" })
        .click();
    });
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

test("restored parallel creation retries the original request without rebuilding selection", async () => {
  sessionStorage.clear();
  const saved = prepareResponseGroupCreation(
    sessionStorage,
    "test-owner",
    "Keep both copies of this model",
    ["openai/gpt-4.1", "openai/gpt-4.1"]
  );
  runtime.resolve.mockRejectedValue(new Error("Still unconfirmed"));
  const fixture = await mount(<NewEveConversation ownerId="test-owner" />);
  try {
    await expect
      .element(page.getByRole("region", { name: "Conversation recovery" }))
      .toHaveTextContent("Keep both copies of this model");
    await expect
      .element(page.getByRole("textbox", { name: "Message" }))
      .not.toBeInTheDocument();
    expect(runtime.resolve).not.toHaveBeenCalled();
    await act(async () => {
      await page.getByRole("button", { name: "Retry creation" }).click();
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Still unconfirmed");
    expect(runtime.resolve.mock.calls).toEqual([
      [sessionStorage, "test-owner", saved, undefined],
    ]);
    expect(readCreationRequest(sessionStorage, "test-owner")).toEqual(saved);
    expect(runtime.open).not.toHaveBeenCalled();
  } finally {
    sessionStorage.clear();
    await unmount(fixture);
  }
});
