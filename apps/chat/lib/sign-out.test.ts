import { expect, it, vi } from "vitest";
import { signOutAndNavigate } from "./sign-out";

it.each([true, false])(
  "navigates only after successful sign-out: %s",
  async (success) => {
    const navigate = vi.fn<() => void>();
    const onFailure = vi.fn<() => void>();
    const signOut = vi.fn<() => Promise<void>>();
    if (success) {
      signOut.mockResolvedValue();
    } else {
      signOut.mockRejectedValue(new Error("Sign-out failed"));
    }
    await signOutAndNavigate({ signOut, navigate, onFailure });
    expect(navigate).toHaveBeenCalledTimes(success ? 1 : 0);
    expect(onFailure).toHaveBeenCalledTimes(success ? 0 : 1);
  }
);
