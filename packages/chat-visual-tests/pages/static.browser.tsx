import { expect, test } from "vitest";
import { page } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import ChatLoading from "@/app/(chat)/loading";
import SettingsLayout from "@/app/(chat)/settings/layout";
import SettingsLoading from "@/app/(chat)/settings/loading";
import RootLoading from "@/app/loading";
import NotFound from "@/app/not-found";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { ChatLoadingShell } from "@/components/chat-loading-shell";

import { signedIn } from "./fixtures";
import { renderRoute } from "./render";

test("privacy policy", async () => {
  await renderRoute(<PrivacyPage />, { path: "/privacy" });
  await expect
    .element(page.getByRole("heading", { name: "Data Security" }))
    .toBeVisible();
});

test("terms of service", async () => {
  await renderRoute(<TermsPage />, { path: "/terms" });
  await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("page not found", async () => {
  await renderRoute(<NotFound />, { path: "/missing" });
  await expect.element(page.getByText("Page Not Found")).toBeVisible();
});

// The route's loading.tsx: a skeleton laid over the page frame. The chat layout's own
// fallback is the conversation shell, whose skeletons are nested, not overlaid.
const routeLoading = () =>
  document.querySelector('.h-dvh ~ [data-slot="skeleton"]') !== null;
const conversationShells = () =>
  document.querySelectorAll('header [data-slot="skeleton"].w-36').length;

test("app loading skeleton", async () => {
  await renderRoute(<RootLoading />);
  await expect.poll(routeLoading).toBe(true);
});

test("chat loading skeleton beside the sidebar", async () => {
  await renderRoute(
    <ChatLayout>
      <ChatLoading />
    </ChatLayout>,
    { ...signedIn, viewports: ["desktop"] }
  );
  await expect.element(page.getByText("Maya Chen")).toBeVisible();
  await expect.poll(routeLoading).toBe(true);
  expect(conversationShells()).toBe(0);
});

test("settings loading skeleton inside the settings frame", async () => {
  await renderRoute(
    <ChatLayout>
      <SettingsLayout>
        <SettingsLoading />
      </SettingsLayout>
    </ChatLayout>,
    { ...signedIn, path: "/settings/models" }
  );
  await expect
    .element(page.getByRole("link", { name: "Connectors" }))
    .toBeVisible();
  await expect.poll(routeLoading).toBe(true);
});

test("conversation loading shell", async () => {
  await renderRoute(
    <ChatLayout>
      <ChatLoadingShell />
    </ChatLayout>,
    signedIn
  );
  await expect.element(page.getByText("Maya Chen")).toBeVisible();
  await expect.poll(conversationShells).toBe(1);
});
