import { conversationOf } from "eve/client";
/// <reference types="@vitest/browser-playwright" />
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { EveConversation } from "@/components/eve/eve-conversation";
import { EveLogicalContext } from "@/components/eve/eve-logical-context";
import { LogicalChat } from "@/lib/eve/logical-chat";
import type { NativeChatAgent } from "@/lib/eve/logical-chat";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";

const singleInvocation = 1;
const header = <div />;
const branchId = "11111111-1111-4111-8111-111111111111";
const sessionId = "fixture-conversation-session";
const ownerId = "fixture-user";

test("conversation retains its draft across rerenders and shows delivery recovery after deferred failure", async (): Promise<void> => {
  sessionStorage.clear();
  const pending = Promise.withResolvers<never>();
  const send = vi.fn(async () => await pending.promise);
  const resume = vi.fn<NativeChatAgent["resume"]>(async () => {
    // The fixture has no live reader.
  });
  const agent: NativeChatAgent = {
    cancel: vi
      .fn<NativeChatAgent["cancel"]>()
      .mockRejectedValue(new Error("Unexpected cancellation")),
    ...conversationOf([]),
    clear: async () => await Promise.reject(new Error("Unexpected clear")),
    compact: async () => await Promise.reject(new Error("Unexpected compact")),
    end: async () => await Promise.reject(new Error("Unexpected end")),
    follow: vi.fn<() => void>(),
    error: undefined,
    events: [],
    prewarm: vi
      .fn<NativeChatAgent["prewarm"]>()
      .mockRejectedValue(new Error("Unexpected prewarm")),
    newSession: vi.fn<() => void>(),
    respond: async () => await Promise.reject(new Error("Unexpected response")),
    resume,
    send,
    session: undefined,
    status: "idle",
  };
  const controller = new LogicalChat(branchId, branchId);
  controller.observe(branchId, agent);
  const value = { controller, ownerId, snapshot: controller.getSnapshot() };
  const state = await mountNative(
    <EveLogicalContext value={value}>
      <EveConversation
        branchId={branchId}
        header={header}
        ownerId={ownerId}
        sessionId={sessionId}
      />
    </EveLogicalContext>
  );
  try {
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await act(async (): Promise<void> => {
      await page
        .getByRole("textbox")
        .fill("Preserve this draft across a render");
    });
    act((): void => {
      controller.commands.update(branchId, { cancelling: false });
    });
    await expect
      .element(page.getByRole("textbox"))
      .toHaveValue("Preserve this draft across a render");
    await takeSnapshot("conversation-draft");
    await page.getByRole("main").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      await page.getByRole("button", { exact: true, name: "Send" }).click();
    });
    await expect.poll(() => send.mock.calls.length).toBe(singleInvocation);
    await act(async (): Promise<void> => {
      pending.reject(new Error("Fixture transport unavailable"));
      await pending.promise.catch(() => {
        /* The component handles this transport rejection. */
      });
    });
    const recovery = page
      .getByRole("alert")
      .filter({ hasText: "Message delivery is unconfirmed" });
    await expect
      .element(recovery.getByText("Message delivery is unconfirmed"))
      .toBeVisible();
    await expect
      .element(recovery.getByRole("button", { name: "Reconnect" }))
      .toBeVisible();
    await expect
      .element(page.getByText("Fixture transport unavailable", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Connection interrupted", { exact: true }))
      .not.toBeInTheDocument();
    await takeSnapshot("conversation-delivery-recovery");
    await page.getByRole("main").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      await recovery.getByRole("button", { name: "Reconnect" }).click();
    });
    expect(resume).toHaveBeenCalledOnce();
    await act(async (): Promise<void> => {
      await page.getByRole("button", { name: "Restore draft" }).click();
    });
    await expect
      .element(page.getByRole("textbox"))
      .toHaveValue("Preserve this draft across a render");
    await expect.element(recovery).not.toBeInTheDocument();
    expect(send).toHaveBeenCalledOnce();
  } finally {
    pending.reject(new Error("Fixture cleanup"));
    await pending.promise.catch(() => {
      /* Discharge an unused gate when an earlier assertion fails. */
    });
    await unmount(state.fixture);
    state.queryClient.clear();
    sessionStorage.clear();
  }
});
