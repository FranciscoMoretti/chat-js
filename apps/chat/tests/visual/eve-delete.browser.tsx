/// <reference types="@vitest/browser-playwright" />
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { EveDeleteDialog } from "@/components/eve/eve-delete-dialog";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";

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
const conversation = {
  id: sourceId,
  state: "bound",
  title: "Fixture conversation",
};
afterEach((): void => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

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
