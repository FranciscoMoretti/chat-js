import { TrpcFixtureError, route } from "./route";
import { expect, onTestFinished, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import HomePage from "@/app/(chat)/page";
import {
  readCreationFollowUp,
  saveCreationFollowUp,
} from "@/lib/eve/pending-create";

import {
  history,
  now,
  signedIn,
  signedInTrpc,
  creationFailure,
  expiredGuestBinding,
  guestTranscript,
  invoicesConversation,
  invoicesTrpc,
  session,
} from "./fixtures";
import { captureVariants, renderRoute } from "./render";

const home = (
  <ChatLayout>
    <HomePage />
  </ChatLayout>
);
const guestServer = { modelIds: ["google/gemini-2.5-flash-lite"] };

test("clearing a recovered New Chat draft removes its saved text", async () => {
  const { id } = session.user;
  saveCreationFollowUp(
    sessionStorage,
    id,
    "Save this follow-up after recovery"
  );
  await renderRoute(home, signedIn);
  const composer = page.getByTestId("multimodal-input");
  await expect
    .element(composer)
    .toHaveValue("Save this follow-up after recovery");
  const input = composer.element();
  const initialHeight = input.clientHeight;
  const multiline = "A line of the revised draft.\n".repeat(40);
  await composer.fill(multiline);
  expect(input.clientHeight).toBeGreaterThan(initialHeight);
  expect(input.scrollHeight).toBeGreaterThan(input.clientHeight);
  expect(readCreationFollowUp(sessionStorage, id)).toBe(multiline);
  await composer.fill("Revised draft");
  expect(input.clientHeight).toBe(initialHeight);
  expect(readCreationFollowUp(sessionStorage, id)).toBe("Revised draft");
  await composer.fill("");
  expect(readCreationFollowUp(sessionStorage, id)).toBe("");
});

test("a recovered draft grows and shrinks without browser field sizing", async () => {
  const supports = vi.spyOn(CSS, "supports").mockReturnValue(false);
  const style = document.createElement("style");
  style.textContent = "textarea { field-sizing: fixed !important; }";
  document.head.append(style);
  onTestFinished(() => {
    supports.mockRestore();
    style.remove();
  });

  const wrapped = "Write the launch notes for the next release. ".repeat(10);
  saveCreationFollowUp(sessionStorage, session.user.id, wrapped);
  await renderRoute(home, signedIn);
  const composer = page.getByRole("textbox", { name: "Message" });
  await expect.element(composer).toHaveValue(wrapped);
  const input = composer.element();
  const wideHeight = input.clientHeight;
  await page.viewport(390, 844);
  await expect.poll(() => input.clientHeight).toBeGreaterThan(wideHeight);
  const wrappedHeight = input.clientHeight;
  expect(input.scrollHeight).toBe(input.clientHeight);

  await composer.fill("One line of a long draft.\n".repeat(40));
  expect(input.scrollHeight).toBeGreaterThan(input.clientHeight);
  await composer.fill("");
  expect(input.clientHeight).toBeLessThan(wrappedHeight);
  expect(`${input.clientHeight}px`).toBe(getComputedStyle(input).minHeight);
  await composer.fill(wrapped);
});

test("home with Guest Chat installed has a fixed inexpensive model", async () => {
  await renderRoute(home, { server: guestServer });
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: /GPT-5 nano/u }))
    .toBeDisabled();
  await expect
    .element(page.getByRole("button", { name: "Sign in" }).first())
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Composer options" }))
    .not.toBeInTheDocument();
  expect(document.querySelector('input[type="file"]')).toBeNull();
  await page.viewport(390, 844);
  const layout = document.querySelector('[data-slot="chat-conversation"]');
  expect(layout?.getBoundingClientRect().height).toBe(844);
  const header = document.querySelector("header");
  if (!header) {
    throw new Error("Home header is missing");
  }
  await expect
    .element(
      page
        .elementLocator(header)
        .getByRole("button", { name: "Sign in", exact: true })
    )
    .toBeVisible();
  // Return to the first capture viewport and wait for the async sidebar header.
  // Its skeleton has the same geometry as Search, so layout stability alone
  // can capture a blank icon before Suspense resolves on the desktop remount.
  await page.viewport(1440, 900);
  await expect
    .element(page.getByRole("button", { name: /Search chats/u }))
    .toBeVisible();
});

test("home signed in lists projects and chat history", async () => {
  await renderRoute(home, signedIn);
  await expect
    .element(page.getByRole("link", { name: /New Chat/u }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "New project", exact: true }))
    .toBeVisible();
  await expect.element(page.getByText("Chats", { exact: true })).toBeVisible();
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  const appMark = page.getByRole("link", { name: "ChatJS", exact: true });
  await expect.element(appMark).toBeVisible();
  await expect
    .poll(() => {
      const image = appMark.element().querySelector("img");
      return image instanceof HTMLImageElement && image.naturalWidth > 0;
    })
    .toBe(true);
  await expect.element(page.getByText("Q4 launch")).toBeVisible();
  await expect
    .element(page.getByText("Onboarding email sequence ideas"))
    .toBeVisible();
  await expect.element(page.getByText("Maya Chen")).toBeVisible();
  await expect.element(page.getByText("8.42", { exact: true })).toBeVisible();
  const sidebar = document.querySelector('[data-slot="sidebar-inner"]');
  if (!sidebar) {
    throw new Error("Expanded sidebar is missing");
  }
  const panel = sidebar.getBoundingClientRect();
  const dividers = sidebar.querySelectorAll('[data-sidebar="separator"]');
  expect(dividers).toHaveLength(2);
  for (const divider of dividers) {
    const bounds = divider.getBoundingClientRect();
    const leftInset = bounds.left - panel.left;
    expect(leftInset).toBeGreaterThan(0);
    expect(panel.right - bounds.right).toBeCloseTo(leftInset);
  }
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toHaveAttribute("data-slot", "input-group-control");
  await expect
    .element(page.getByRole("button", { name: "Send", exact: true }))
    .toBeDisabled();
});

test("theme toggle in the account menu", async () => {
  await renderRoute(home, { ...signedIn, viewports: ["desktop"] });
  await page.getByRole("button", { name: /Maya Chen/u }).click();
  const toggle = page.getByRole("menuitem", { name: "Toggle Theme" });
  await expect.element(toggle).toBeVisible();
  expect(toggle.element().querySelector(".lucide-sun")?.checkVisibility()).toBe(
    true
  );
  expect(
    toggle.element().querySelector(".lucide-moon")?.checkVisibility()
  ).toBe(false);
  await captureVariants("account-menu");
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
  await expect
    .element(page.getByRole("link", { name: "Models", exact: true }))
    .toBeVisible();
});

test("home shows an unavailable balance instead of a false zero", async () => {
  await renderRoute(home, {
    ...signedIn,
    viewports: ["desktop"],
    trpc: {
      ...signedInTrpc,
      "credits.getAvailableCredits": new TrpcFixtureError(
        "INTERNAL_SERVER_ERROR",
        "Balance lookup unavailable"
      ),
    },
  });
  await expect.element(page.getByText("Balance unavailable")).toBeVisible();
  await expect
    .element(page.getByText("0.00", { exact: true }))
    .not.toBeInTheDocument();
});

test("signed-in composer options expose uploads with the native menu", async () => {
  await renderRoute(home, { ...signedIn, fakeTimeouts: true });
  await expect
    .element(page.getByText("How can I help you today?"))
    .toBeVisible();
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toHaveFocus();
  // Flush the composer's fallback focus before the menu takes focus.
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
  vi.useFakeTimers({ now, toFake: ["Date"] });
  await page.getByRole("button", { name: "Composer options" }).click();
  await expect
    .element(page.getByRole("menuitem", { name: "Attach files" }))
    .toBeVisible();
  await expect.element(page.getByRole("menu")).toHaveFocus();
  const items = [...document.querySelectorAll('[role="menuitem"]')].map(
    (item) => item.textContent
  );
  expect(items[0]).toContain("Attach files");
  await page.screenshot({ path: "__screenshots__/home-upload-menu.png" });
});

test("account composer supplies parallel model selection", async () => {
  await renderRoute(home, signedIn);
  await page.getByTestId("model-selector").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  const list = page.getByRole("listbox");
  const selected = list.getByRole("option", { selected: true });
  const modelName = selected.element().getAttribute("aria-label");
  const search = page.getByRole("combobox", { name: "Search models" });
  await search.click();
  await userEvent.keyboard("{ArrowDown}{ArrowDown}");
  await expect.element(list).toHaveAttribute("aria-multiselectable", "true");
  await expect.element(search).toHaveAttribute("aria-activedescendant");
  expect(selected.element().getAttribute("aria-label")).toBe(modelName);
  await expect
    .element(page.getByRole("button", { name: /^1× /u }))
    .toBeVisible();
});

test("the signed-in picker searches the discovered gateway catalog", async () => {
  await renderRoute(home, { ...signedIn, server: { modelIds: [] } });
  await page.getByTestId("model-selector").click();
  await page.getByRole("combobox", { name: "Search models" }).fill("Llama 3.3");
  await expect
    .element(page.getByRole("link", { name: "Manage models" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("option", { name: /Llama 3\.3 70B Instruct/u }))
    .toBeVisible();
});

test("the composer chooses a usable model when its configured default is absent", async () => {
  await renderRoute(home, {
    ...signedIn,
    server: { modelIds: ["openai/gpt-5-mini"] },
    viewports: ["desktop"],
  });
  await expect
    .element(page.getByTestId("model-selector"))
    .toHaveTextContent("GPT-5 mini");
});

test("signed-in chat accepts a follow-up draft while creating the first turn", async () => {
  const { fetch } = globalThis;
  const startup = Promise.withResolvers<Response>();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/agent-conversations") {
      return await startup.promise;
    }
    return await fetch(input, init);
  });
  await renderRoute(home, signedIn);
  const composer = page.getByTestId("multimodal-input");
  const send = page.getByRole("button", { name: "Send", exact: true });
  await composer.fill("Summarize this month's invoices.");
  await send.click();
  await expect
    .element(
      page.getByText("Summarize this month's invoices.", { exact: true })
    )
    .toBeVisible();
  await expect.element(composer).toHaveProperty("readOnly", false);
  await composer.fill("Can you also check last month?");
  await expect.element(composer).toHaveValue("Can you also check last month?");
  await expect.element(send).toBeDisabled();
});

test("home shows a rejected new conversation as a chat alert", async () => {
  const { fetch } = globalThis;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/agent-conversations") {
      return Response.json(
        { creationRejected: true, error: creationFailure },
        { status: 400 }
      );
    }
    return await fetch(input, init);
  });
  await renderRoute(home, signedIn);
  // This capture checks bootstrap and presentation; EVE replies are fixtures.
  await expect
    .element(
      page.getByText("Hello! How can I help you today?", { exact: true })
    )
    .not.toBeInTheDocument();
  await page.getByRole("textbox", { name: "Message" }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect
    .element(alert.getByText("Chat error", { exact: true }))
    .toBeVisible();
  await expect.element(alert.getByText(creationFailure)).toBeVisible();
  await page.screenshot({ path: "__screenshots__/new-conversation-error.png" });
});

test("signed-in creation retry saves the follow-up even if the destination draft is unreadable", async () => {
  const { fetch } = globalThis;
  const startup = Promise.withResolvers<Response>();
  const binding = {
    id: invoicesConversation.id,
    sessionId: invoicesConversation.sessionId,
  };
  let requests = 0;
  let savedAtNavigation: string | null = null;
  const destinationKey = `chatjs.eve.composer:${invoicesConversation.ownerId}:${invoicesConversation.chatId}`;
  sessionStorage.setItem(destinationKey, "{unreadable");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/agent-conversations") {
      requests += 1;
      return requests === 1 ? await startup.promise : Response.json(binding);
    }
    return await fetch(input, init);
  });
  vi.spyOn(globalThis.history, "pushState").mockImplementation(
    (_data, _unused, url) => {
      if (typeof url === "string") {
        savedAtNavigation = sessionStorage.getItem(destinationKey);
        route.path = url;
      }
    }
  );
  await renderRoute(home, {
    ...signedIn,
    trpc: invoicesTrpc,
    agentStatus: "streaming",
  });
  const composer = page.getByTestId("multimodal-input");
  await composer.fill("Summarize this month's invoices.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const followUp = "Can you also check last month?";
  await composer.fill(followUp);
  startup.resolve(Response.json({ error: "Try again" }, { status: 502 }));
  await page
    .getByRole("button", { name: "Retry creation", exact: true })
    .click();
  await expect.element(composer).toHaveValue(followUp);
  await expect
    .element(page.getByRole("button", { name: "Send", exact: true }))
    .toBeEnabled();
  expect(route.path).toBe(`/chat/${invoicesConversation.chatId}`);
  expect(savedAtNavigation).toContain(followUp);
  expect(requests).toBe(2);
});

test("guest chat keeps a follow-up draft through session startup and streaming", async () => {
  const bootstrap = Promise.withResolvers<Response>();
  const { fetch } = globalThis;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/eve-guest") {
      return await bootstrap.promise;
    }
    return await fetch(input, init);
  });
  await renderRoute(home, {
    agentStatus: "streaming",
    server: guestServer,
    transcripts: { "guest-session": guestTranscript },
  });
  // This capture checks bootstrap and presentation; EVE replies are fixtures.
  await expect
    .element(
      page.getByText("Hello! How can I help you today?", { exact: true })
    )
    .not.toBeInTheDocument();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await composer.fill("Hello");
  await send.click();
  await expect.element(send).toBeDisabled();
  await expect.element(composer).toHaveProperty("readOnly", false);
  await expect.element(composer).toHaveValue("");
  await composer.fill("Could you give me an example?");
  await captureVariants("startup");
  bootstrap.resolve(
    Response.json({
      sessionId: "guest-session",
      credential: "guest-fixture",
      expiresAt: Date.now() + 3_600_000,
    })
  );
  await expect
    .element(
      page.getByText("Hello! How can I help you today?", { exact: true })
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: /GPT-5 nano/u }))
    .toBeDisabled();
  await expect.element(composer).toHaveProperty("readOnly", false);
  await expect.element(composer).toHaveValue("Could you give me an example?");
  const followUp = "Could you give me two examples?\nOne for each case.";
  await composer.fill(followUp);
  await expect.element(composer).toHaveValue(followUp);
  await expect
    .element(page.getByRole("button", { name: "Stop", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(send).toBeEnabled();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await captureVariants("steering");
  await send.click();
  await expect.element(composer).toHaveValue("");
  await expect
    .element(page.getByRole("button", { name: "Stop", exact: true }))
    .toBeEnabled();
});

test("guest startup failure keeps the original message and newer draft", async () => {
  const bootstrap = Promise.withResolvers<Response>();
  const { fetch } = globalThis;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/eve-guest") {
      return await bootstrap.promise;
    }
    return await fetch(input, init);
  });
  await renderRoute(home, { server: guestServer });
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await composer.fill("What is a directed graph?");
  await send.click();
  await composer.fill("Include a concrete example.");
  bootstrap.resolve(Response.json({ error: "Try again" }, { status: 502 }));
  await expect
    .element(composer)
    .toHaveValue("What is a directed graph?\n\nInclude a concrete example.");
  await expect.element(send).toBeEnabled();
});

test("expired guest chat shows the New chat action beside the notice", async () => {
  const { fetch } = globalThis;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input === "/api/eve-guest") {
      return Response.json(expiredGuestBinding);
    }
    return await fetch(input, init);
  });
  await renderRoute(home, {
    server: guestServer,
    transcripts: { [expiredGuestBinding.sessionId]: guestTranscript },
  });
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await composer.fill("Hello");
  await send.click();

  const notice = page.getByText("This chat has expired.", { exact: true });
  const newChat = page.getByRole("button", { name: "New chat", exact: true });
  await expect.element(notice).toBeVisible();
  await expect.element(newChat).toBeEnabled();
  await expect.element(send).toBeDisabled();
  await page.viewport(390, 844);
  const noticeBounds = notice.element().getBoundingClientRect();
  const buttonBounds = newChat.element().getBoundingClientRect();
  expect(buttonBounds.left).toBeGreaterThan(noticeBounds.right);
  expect(buttonBounds.top).toBeLessThan(noticeBounds.bottom);
  await page.screenshot({ path: "__screenshots__/guest-expired.png" });
});
