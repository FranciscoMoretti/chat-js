import { takeSnapshot } from "@uiverify/vitest";
import { act, createContext, useContext } from "react";
import { Plugins } from "@/lib/ui-slots";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { creditsClient } from "@/plugins/credits/client-plugin";
import "./sandbox.css";

const Balance = createContext<{
  balanceCents: number | undefined;
  isError: boolean;
}>({ balanceCents: undefined, isError: false });
vi.mock("@/plugins/credits/use-credits", () => ({
  useGetCredits: () => useContext(Balance),
}));
vi.mock("@/lib/auth-client", () => ({ default: {} }));
vi.mock("@/composition/generated/installed-sign-out", () => ({
  signOutWithPlugin: async (): Promise<boolean> => await Promise.resolve(false),
}));
vi.mock("@/composition/generated/installed-navigation", () => ({
  handleModifiedNavigation: () => false,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: {
      user: {
        email: "fixture@example.test",
        name: "Fixture user",
        image:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23888'/%3E%3C/svg%3E",
      },
    },
    isPending: false,
  }),
}));

const states = [
  { label: "Starting balance", balanceCents: 50, isError: false },
  { label: "Depleted", balanceCents: 0, isError: false },
  { label: "Overdraft", balanceCents: -17, isError: false },
  { label: "Loading", balanceCents: undefined, isError: false },
  { label: "Failed refresh with stale data", balanceCents: 50, isError: true },
];
test.each([true, false])(
  "account menu with credits installed: %s",
  async (enabled) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(
          <div className="grid gap-4 p-6">
            {(enabled ? states : states.slice(0, 1)).map(
              ({ label, ...balance }) => (
                <section key={label} className="w-64">
                  <h2>{enabled ? label : "Credits not installed"}</h2>
                  <Plugins plugins={enabled ? [creditsClient] : []}>
                    <Balance value={balance}>
                      <SidebarProvider className="min-h-0">
                        <SidebarUserNav />
                      </SidebarProvider>
                    </Balance>
                  </Plugins>
                </section>
              )
            )}
          </div>
        );
      });
      if (enabled) {
        await expect
          .element(page.getByText("0.50", { exact: true }))
          .toBeVisible();
        await expect
          .element(page.getByText("-0.17", { exact: true }))
          .toBeVisible();
        expect(page.getByText("0.00", { exact: true }).elements()).toHaveLength(
          1
        );
        await expect
          .element(page.getByText("Loading balance…", { exact: true }))
          .toBeVisible();
        await expect
          .element(page.getByText("Balance unavailable", { exact: true }))
          .toBeVisible();
      } else {
        await expect.element(page.getByText("Fixture user")).toBeVisible();
        await expect
          .element(page.getByText("0.50", { exact: true }))
          .not.toBeInTheDocument();
      }
      await expect
        .poll(
          () =>
            page.getByRole("img", { name: "Fixture user" }).elements().length
        )
        .toBe(enabled ? states.length : 1);
      await takeSnapshot(
        enabled ? "credits-account-states" : "account-without-credits"
      );
    } finally {
      await act(async () => {
        await Promise.resolve();
        root.unmount();
      });
      container.remove();
    }
  }
);
