/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarProvider } from "@/components/ui/sidebar";

import "./sandbox.css";
/* oxlint-enable sort-imports */

const auth = vi.hoisted(() => ({ electron: false, signOut: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ default: auth }));
vi.mock("@/lib/electron-auth", () => ({
  isElectronRenderer: (): boolean => auth.electron,
}));
vi.mock("@/hooks/use-credits", () => ({
  useGetCredits: (): { credits: number } => ({ credits: 0 }),
}));
vi.mock("next/navigation", () => ({ useRouter: (): object => ({}) }));
vi.mock("@/providers/session-provider", () => ({
  useSession: (): object => ({
    data: { user: { email: "fixture@example.test", name: "Fixture user" } },
    isPending: false,
  }),
}));

/* oxlint-disable max-statements, max-lines-per-function -- Keep sign-out failure, unchanged navigation, and actionable feedback in one browser scenario. */
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
        if (mode === "electron-sync") {
          expect(syncAuthSession).toHaveBeenCalledOnce();
        } else {
          expect(syncAuthSession).not.toHaveBeenCalled();
        }
      }
      expect(globalThis.location.href).toBe(origin);
      if (mode === "browser") {
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
/* oxlint-enable max-statements, max-lines-per-function */

/* oxlint-enable oxc/no-async-await */
