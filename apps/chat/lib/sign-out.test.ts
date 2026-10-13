import { describe, expect, it, vi } from "vitest";

import { signOutAndNavigate } from "./sign-out";

const firstInvocation = 0;
describe("sign-out completion", () => {
  it("navigates after native sign-out even if session refresh fails", async () => {
    const failure = new Error("Refresh failed");
    const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
    const syncSession = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const navigate = vi.fn<() => void>();
    const onFailure = vi.fn<() => void>();
    const onSyncFailure = vi.fn<(error: unknown) => void>();
    await signOutAndNavigate({
      navigate,
      onFailure,
      onSyncFailure,
      signOut,
      syncSession,
    });
    expect(signOut).toHaveBeenCalledOnce();
    expect(syncSession).toHaveBeenCalledOnce();
    expect(onSyncFailure).toHaveBeenCalledWith(failure);
    expect(onFailure).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnce();
    expect(signOut.mock.invocationCallOrder.at(firstInvocation)).toBeLessThan(
      syncSession.mock.invocationCallOrder.at(firstInvocation) ?? Infinity
    );
    expect(
      syncSession.mock.invocationCallOrder.at(firstInvocation)
    ).toBeLessThan(
      navigate.mock.invocationCallOrder.at(firstInvocation) ?? Infinity
    );
  });
  it("keeps the page and reports a sign-out failure before attempting refresh", async () => {
    const signOut = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("Sign-out failed"));
    const syncSession = vi.fn<() => Promise<void>>();
    const navigate = vi.fn<() => void>();
    const onFailure = vi.fn<() => void>();
    await signOutAndNavigate({
      navigate,
      onFailure,
      onSyncFailure: vi.fn<(error: unknown) => void>(),
      signOut,
      syncSession,
    });
    expect(onFailure).toHaveBeenCalledOnce();
    expect(syncSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
