import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import HomePage from "@/app/(chat)/page";

import { signedIn } from "./fixtures";
import { renderRoute } from "./render";

const pending = vi.hoisted(() => Promise.withResolvers<null>());

vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: async () => await pending.promise,
}));

test.each(["desktop", "mobile"] as const)(
  "sidebar header keeps its list item while identity loads (%s)",
  async (viewport) => {
    await renderRoute(
      <ChatLayout>
        <HomePage />
      </ChatLayout>,
      { ...signedIn, viewports: [viewport], allowPendingSidebar: true }
    );
    await expect
      .element(page.getByRole("link", { name: "Models" }))
      .toBeVisible();
    if (viewport === "mobile") {
      await page.viewport(390, 844);
      await expect
        .element(page.getByRole("link", { name: "Models" }))
        .not.toBeInTheDocument();
      // Let the viewport change install the mobile shortcut handler before opening it.
      const frame = Promise.withResolvers<null>();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          frame.resolve(null);
        });
      });
      await frame.promise;
      globalThis.dispatchEvent(
        new KeyboardEvent("keydown", { ctrlKey: true, key: "b" })
      );
      await expect
        .element(page.getByRole("link", { name: "Models" }))
        .toBeVisible();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    await expect
      .poll(
        () =>
          document.querySelector(
            '[data-slot="sidebar-header"] [data-slot="skeleton"]'
          )?.parentElement?.tagName
      )
      .toBe("LI");
    await expect
      .element(page.getByRole("button", { name: /Search chats/u }))
      .not.toBeInTheDocument();
  }
);
