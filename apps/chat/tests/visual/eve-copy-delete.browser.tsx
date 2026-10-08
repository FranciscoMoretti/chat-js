/// <reference types="@vitest/browser-playwright" />
/* oxlint-disable sort-imports -- Oxfmt groups React and browser fixture imports by module; the enabled binding-order rule requires a conflicting grouping. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { EveCopyButton } from "@/components/eve/eve-copy-button";
import { EveDeleteDialog } from "@/components/eve/eve-delete-dialog";
import {
  finishPendingEveCopy,
  preparePendingEveCopy,
} from "@/lib/eve/request-copy";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: (): string => "openai/gpt-4.1",
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: (): {
    readonly data: { readonly user: { readonly id: string } };
    readonly isPending: false;
  } => ({
    data: { user: { id: "copy-owner" } },
    isPending: false,
  }),
}));
const singleInvocation = 1;
const sourceId = "11111111-1111-4111-8111-111111111111";
const destinationId = "22222222-2222-4222-8222-222222222222";
const conversation = {
  id: sourceId,
  state: "bound",
  title: "Fixture conversation",
};
afterEach((): void => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

/* oxlint-disable max-statements, max-lines-per-function, oxc/no-async-await -- Keep the deferred native request, duplicate-click guard, durable retry and visible recovery in one browser lifecycle; await React commits and browser assertions. */
test("copy locks duplicate clicks and retries the same durable request", async (): Promise<void> => {
  const pending = Promise.withResolvers<Response>();
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockReturnValue(pending.promise);
  const fixture = await mount(
    <EveCopyButton sourceConversationId={sourceId} />
  );
  try {
    const button = page.getByRole("button", { name: "Save to your chats" });
    await expect.element(button).toBeVisible();
    const element = button.element();
    act((): void => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect
      .element(page.getByRole("button", { exact: true, name: "Saving..." }))
      .toBeDisabled();
    expect(request).toHaveBeenCalledOnce();
    const stored = preparePendingEveCopy(
      sessionStorage,
      "copy-owner",
      sourceId,
      "openai/gpt-4.1"
    );
    await takeSnapshot("copy-pending");
    await page.getByRole("main").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      pending.resolve(
        Response.json(
          { conversationId: destinationId, error: "Saving unconfirmed" },
          { status: 503 }
        )
      );
      await pending.promise;
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Saving unconfirmed");
    await expect
      .element(page.getByRole("link", { name: "Open saved copy recovery" }))
      .toHaveAttribute("href", `/chat/${destinationId}`);
    expect(
      preparePendingEveCopy(
        sessionStorage,
        "copy-owner",
        sourceId,
        "other-model"
      )
    ).toEqual(stored);
    request.mockResolvedValue(
      Response.json({ error: "Still unconfirmed" }, { status: 503 })
    );
    await act(async (): Promise<void> => {
      await page.getByRole("button", { name: "Retry saving" }).click();
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Still unconfirmed");
    const { lastCall } = request.mock;
    if (!lastCall) {
      throw new Error("No retry request was recorded");
    }
    const [, options] = lastCall;
    expect(options).toEqual(
      expect.objectContaining({ body: JSON.stringify(stored) })
    );
    await takeSnapshot("copy-retry");
    await page.getByRole("main").screenshot({ animations: "disabled" });
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable max-statements, max-lines-per-function, oxc/no-async-await */

/* oxlint-disable max-statements, oxc/no-async-await -- Verify authoritative rejection, storage failure tolerance and rendered recovery together; await browser commits and cleanup. */
test("rejected recovery remains authoritative when storage cleanup fails", async (): Promise<void> => {
  const recovery = preparePendingEveCopy(
    sessionStorage,
    "copy-owner",
    sourceId,
    "openai/gpt-4.1"
  );
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      { error: "Source unavailable", retryable: false },
      { status: 404 }
    )
  );
  const removal = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation((): never => {
      throw new Error("Storage unavailable");
    });
  const fixture = await mount(
    <EveCopyButton recovery={recovery} sourceConversationId={sourceId} />
  );
  try {
    await act(async (): Promise<void> => {
      await page.getByRole("button", { name: "Retry saving" }).click();
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Source unavailable");
    expect(removal).toHaveBeenCalledOnce();
    await expect.element(page.getByRole("button")).not.toBeInTheDocument();
    await takeSnapshot("copy-rejected-recovery");
    await page.getByRole("main").screenshot({ animations: "disabled" });
    removal.mockRestore();
    finishPendingEveCopy(sessionStorage, "copy-owner", recovery);
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable max-statements, oxc/no-async-await */

/* oxlint-disable max-statements, max-lines-per-function, oxc/no-async-await -- Exercise the deferred DELETE, status check and callback rejection in the real dialog controller; await native browser lifecycle completion. */
test("deletion keeps pending state and closes after confirmed status despite refresh failure", async (): Promise<void> => {
  const pending = Promise.withResolvers<Response>();
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(Response.json({ rootId: sourceId, status: "deleted" }));
  const onChanged = vi.fn().mockRejectedValue(new Error("Refresh unavailable"));
  const onClose = vi.fn<() => void>();
  const fixture = await mount(
    <EveDeleteDialog
      conversation={conversation}
      onChanged={onChanged}
      onClose={onClose}
    />
  );
  try {
    await takeSnapshot("delete-confirm");
    await page.getByRole("dialog").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      await page
        .getByRole("button", {
          exact: true,
          name: "Delete conversation and branches",
        })
        .click();
    });
    await expect
      .element(page.getByRole("button", { exact: true, name: "Close" }))
      .toBeDisabled();
    expect(request).toHaveBeenCalledWith(
      `/api/agent-conversations/${sourceId}`,
      expect.objectContaining({ method: "DELETE" })
    );
    await act(async (): Promise<void> => {
      pending.resolve(Response.json({ rootId: sourceId, status: "pending" }));
      await pending.promise;
    });
    await expect
      .element(page.getByRole("button", { name: "Retry deletion" }))
      .toBeVisible();
    expect(onChanged).toHaveBeenCalledWith(sourceId);
    expect(onClose).not.toHaveBeenCalled();
    await takeSnapshot("delete-pending");
    await page.getByRole("dialog").screenshot({ animations: "disabled" });
    await act(async (): Promise<void> => {
      await page.getByRole("button", { name: "Check status" }).click();
    });
    await expect.poll(() => onClose.mock.calls.length).toBe(singleInvocation);
    expect(request).toHaveBeenLastCalledWith(
      `/api/agent-conversations/${sourceId}`,
      expect.objectContaining({ method: "GET" })
    );
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable max-statements, max-lines-per-function, oxc/no-async-await */
