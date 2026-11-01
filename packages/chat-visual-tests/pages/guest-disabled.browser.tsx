import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import LoginPage from "@/app/(auth)/login/page";
import { EveChatPage } from "@/components/eve/eve-chat-page";
import { route } from "./route";
import { renderRoute } from "./render";

vi.mock("@/chatjs/generated/installed-signed-out", () => ({
  installedSignedOutScreens: [],
}));

test("without Guest Chat signed-out chat redirects to login", async () => {
  route.session = null;
  await expect(EveChatPage({})).rejects.toThrow("redirect(/login)");
  await renderRoute(<LoginPage />, {
    path: "/login",
  });
  await expect.element(page.getByText("Welcome back")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Continue with Google" }))
    .toBeVisible();
});
