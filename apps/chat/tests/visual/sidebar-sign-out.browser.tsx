import { signOutDesktop } from "@/plugins/desktop/sign-out";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarProvider } from "@/components/ui/sidebar";

import "./sandbox.css";

vi.mock("@/chatjs/generated/installed-sign-out", () => ({
  signOutWithPlugin: signOutDesktop,
}));
const auth = vi.hoisted(() => ({ electron: false, signOut: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ default: auth }));
vi.mock("@/plugins/desktop/bridge", () => ({
  isElectronRenderer: (): boolean => auth.electron,
}));
vi.mock("@/plugins/credits/use-credits", () => ({
  useGetCredits: (): { balanceCents: number; isError: boolean } => ({
    balanceCents: 0,
    isError: false,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: (): object => ({}) }));
vi.mock("@/providers/session-provider", () => ({
  useSession: (): object => ({
    data: { user: { email: "fixture@example.test", name: "Fixture user" } },
    isPending: false,
  }),
}));

test.each(["browser", "electron-sign-out"])(
  "%s rejection reports failure and stays on the current page",
  async (mode) => {
    auth.electron = mode !== "browser";
    auth.signOut.mockReset().mockRejectedValue(new Error("Sign-out failed"));
    const signOut = vi.fn<() => Promise<void>>().mockResolvedValueOnce();
    const syncAuthSession = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("Sync failed"));
    if (mode === "electron-sign-out") {
      signOut.mockReset().mockRejectedValue(new Error("Bridge failed"));
    }
    vi.stubGlobal("signOut", signOut);
    vi.stubGlobal("electronAPI", { syncAuthSession });
    const origin = globalThis.location.href;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(
          <SidebarProvider>
            <div className="w-64">
              <SidebarUserNav />
            </div>
            <Toaster />
          </SidebarProvider>
        );
      });
      await page.getByRole("button", { name: /Fixture user/u }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
      await expect
        .element(page.getByText("Unable to sign out. Try again."))
        .toBeVisible();
      if (mode === "browser") {
        expect(auth.signOut).toHaveBeenCalledWith({
          fetchOptions: { throw: true },
        });
        expect(signOut).not.toHaveBeenCalled();
      } else {
        expect(auth.signOut).not.toHaveBeenCalled();
        expect(signOut).toHaveBeenCalledOnce();
        expect(syncAuthSession).not.toHaveBeenCalled();
      }
      expect(globalThis.location.href).toBe(origin);
      if (mode === "browser") {
        await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
        await expect
          .poll(
            () =>
              page
                .getByText("Unable to sign out. Try again.")
                .element()
                .closest<HTMLElement>("[data-sonner-toast]")?.dataset.mounted
          )
          .toBe("true");
        await expect
          .poll(() => {
            const toastElement = page
              .getByText("Unable to sign out. Try again.")
              .element()
              .closest<HTMLElement>("[data-sonner-toast]");
            if (!toastElement) {
              return false;
            }
            const bounds = toastElement.getBoundingClientRect();
            return (
              getComputedStyle(toastElement).opacity === "1" &&
              bounds.top >= 0 &&
              bounds.bottom <= globalThis.innerHeight
            );
          })
          .toBe(true);
        await takeSnapshot("sidebar-sign-out-failure");
      }
    } finally {
      await act(async () => {
        await Promise.resolve();
        toast.dismiss();
        root.unmount();
      });
      container.remove();
      vi.unstubAllGlobals();
    }
  }
);
