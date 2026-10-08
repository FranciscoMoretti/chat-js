/// <reference types="@vitest/browser-playwright" />
/* oxlint-disable sort-imports -- Preserve the browser fixture's module grouping required by Oxfmt; sort-imports requests conflicting type and runtime binding groups. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";

import { EveConversation } from "@/components/eve/eve-conversation";
import { EveLogicalContext } from "@/components/eve/eve-logical-context";
import { LogicalChat } from "@/lib/eve/logical-chat";
import type { NativeChatAgent } from "@/lib/eve/logical-chat";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";
/* oxlint-enable sort-imports */

const singleInvocation = 1;
const header = <div />;
const conversationId = "11111111-1111-4111-8111-111111111111";
const sessionId = "fixture-conversation-session";
const ownerId = "fixture-user";

/* oxlint-disable max-lines-per-function, max-statements, oxc/no-async-await -- Keep the actual conversation hooks, rerender, deferred transport and retained draft assertions in one native browser lifecycle; await React and browser completion. */
test("conversation retains its draft across rerenders and shows delivery recovery after deferred failure", async (): Promise<void> => {
  sessionStorage.clear();
  const pending = Promise.withResolvers<never>();
  const send = vi
    .fn<NativeChatAgent["send"]>()
    .mockReturnValue(pending.promise);
  /* oxlint-disable no-undefined -- The native EVE observer requires explicit absent error and session fields; this fixture preserves its ready observer contract. */
  const agent: NativeChatAgent = {
    cancel: vi
      .fn<NativeChatAgent["cancel"]>()
      .mockRejectedValue(new Error("Unexpected cancellation")),
    data: { messages: [] },
    error: undefined,
    events: [],
    prewarm: vi
      .fn<NativeChatAgent["prewarm"]>()
      .mockRejectedValue(new Error("Unexpected prewarm")),
    reset: vi.fn<NativeChatAgent["reset"]>(),
    respond: vi
      .fn<NativeChatAgent["respond"]>()
      .mockRejectedValue(new Error("Unexpected response")),
    resume: vi
      .fn<NativeChatAgent["resume"]>()
      .mockRejectedValue(new Error("Unexpected resume")),
    send,
    session: undefined,
    status: "ready",
  };
  /* oxlint-enable no-undefined */
  const controller = new LogicalChat(conversationId, conversationId);
  controller.observe(conversationId, agent);
  // oxlint-disable-next-line react-perf/jsx-no-new-object-as-prop -- Each lifecycle test owns a fresh real controller and snapshot context; sharing it across tests would retain commands and observers.
  const value = { controller, ownerId, snapshot: controller.getSnapshot() };
  await commands.modelAssets();
  const state = await mountNative(
    <EveLogicalContext value={value}>
      <EveConversation
        conversationId={conversationId}
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
    await act(async (): Promise<void> => {
      controller.commands.update(conversationId, { cancelling: false });
      await Promise.resolve();
    });
    await expect
      .element(page.getByRole("textbox"))
      .toHaveTextContent("Preserve this draft across a render");
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
    await expect
      .element(page.getByText("Fixture transport unavailable", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Reconnect" }))
      .toBeVisible();
    await expect
      .element(
        page.getByText(
          "Message delivery is unconfirmed. Your draft is saved in this tab.",
          { exact: true }
        )
      )
      .toBeVisible();
    await takeSnapshot("conversation-delivery-recovery");
    await page.getByRole("main").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      await page.getByRole("button", { name: "Restore draft" }).click();
    });
    await expect
      .element(page.getByRole("textbox"))
      .toHaveTextContent("Preserve this draft across a render");
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
/* oxlint-enable max-lines-per-function, max-statements, oxc/no-async-await */
