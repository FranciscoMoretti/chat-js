import { expect, test } from "vitest";
import { page } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import HomePage from "@/app/(chat)/page";

import { history, signedIn, signedInTrpc } from "./fixtures";
import { renderRoute } from "./render";

const home = (
  <ChatLayout>
    <HomePage />
  </ChatLayout>
);
test("home for a guest with a fixed inexpensive model", async () => {
  await renderRoute(home);
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: /GPT-5 nano/u }))
    .toBeDisabled();
  await expect
    .element(page.getByRole("button", { name: "Sign in" }).first())
    .toBeVisible();
});

test("home signed in lists projects and chat history", async () => {
  await renderRoute(home, signedIn);
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  await expect.element(page.getByText("Q4 launch")).toBeVisible();
  await expect
    .element(page.getByText("Onboarding email sequence ideas"))
    .toBeVisible();
  await expect.element(page.getByText("Maya Chen")).toBeVisible();
});

test("home for a new account with no chats or projects", async () => {
  const empty = { items: [], nextCursor: null };
  await renderRoute(home, {
    ...signedIn,
    server: { conversations: empty },
    trpc: { ...signedInTrpc, "eve.list": empty, "project.list": [] },
  });
  await expect
    .element(page.getByText("Start chatting to see your conversation history!"))
    .toBeVisible();
});

test("home with more conversations than the first page", async () => {
  const last = history.items.at(-1);
  const firstPage = {
    ...history,
    nextCursor: last
      ? { id: last.id, isPinned: last.isPinned, updatedAt: last.updatedAt }
      : null,
  };
  await renderRoute(home, {
    ...signedIn,
    server: { conversations: firstPage },
    trpc: { ...signedInTrpc, "eve.list": firstPage },
    viewports: ["desktop"],
  });
  const loadMore = page.getByRole("button", {
    name: "Load more conversations",
  });
  await expect.element(loadMore).toBeVisible();
  // Scroll once the projects above it have loaded, or they push it back down.
  await expect.element(page.getByText("Q4 launch")).toBeVisible();
  // It sits at the end of the history, below the fold of the sidebar.
  loadMore.element().scrollIntoView({ block: "end" });
});

test("home signed in with the sidebar collapsed", async () => {
  // On a phone the sidebar is a closed sheet either way.
  await renderRoute(home, { ...signedIn, cookies: {}, viewports: ["desktop"] });
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  await expect
    .poll(() =>
      document.querySelector('[data-state="collapsed"][data-side="left"]')
    )
    .not.toBeNull();
});
