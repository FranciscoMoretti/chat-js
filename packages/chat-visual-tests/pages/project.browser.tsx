import { expect, test } from "vitest";
import { page } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import ProjectPage from "@/app/(chat)/project/[projectId]/page";
import { prepareCreation } from "@/lib/eve/pending-create";

import {
  chatsIn,
  history,
  launchChats,
  launchProject,
  signedIn,
  signedInTrpc,
  session,
} from "./fixtures";
import { renderRoute } from "./render";
import { TrpcFixtureError, route } from "./route";

const withLaunchChats = {
  ...history,
  items: [...history.items, ...launchChats.items],
};
const project = (
  <ChatLayout>
    <ProjectPage params={Promise.resolve({ projectId: launchProject.id })} />
  </ChatLayout>
);
const request = {
  ...signedIn,
  path: `/project/${launchProject.id}`,
  server: { conversations: withLaunchChats, project: launchProject },
  trpc: {
    ...signedInTrpc,
    "eve.list": (input: { projectId?: string | null }) =>
      chatsIn(withLaunchChats, input),
    "project.getById": launchProject,
  },
};

test("project with instructions and chats", async () => {
  await renderRoute(project, request);
  await expect
    .element(page.getByText("Press release first draft"))
    .toBeVisible();
  await expect.element(page.getByText("✓")).toBeInTheDocument();
});

test("project instructions being edited", async () => {
  await renderRoute(project, request);
  await page.getByRole("button", { name: "Instructions" }).click();
  await expect
    .element(
      page.getByRole("dialog").getByText("Keep answers short", { exact: false })
    )
    .toBeVisible();
});

test("project before its first chat", async () => {
  const empty = { ...launchProject, instructions: "" };
  await renderRoute(project, {
    ...request,
    server: { conversations: history, project: empty },
    trpc: { ...signedInTrpc, "project.getById": empty },
  });
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toBeVisible();
  await expect
    .element(page.getByText("No chats in this project"))
    .toBeVisible();
});

test("project restores its pending payload using a storage-only scope", async () => {
  prepareCreation(
    sessionStorage,
    session.user.id,
    "Keep this launch plan",
    undefined,
    { context: { key: `project:${launchProject.id}`, label: "project" } },
    undefined,
    { projectId: launchProject.id }
  );
  await renderRoute(project, request);
  await expect.element(page.getByText("Keep this launch plan")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Retry creation" }))
    .toBeVisible();
});

test("project that could not be refreshed", async () => {
  await renderRoute(project, {
    ...request,
    trpc: {
      ...request.trpc,
      "project.getById": new TrpcFixtureError(
        "INTERNAL_SERVER_ERROR",
        "The projects service did not respond."
      ),
    },
  });
  await expect
    .element(page.getByText("Press release first draft"))
    .toBeVisible();
  // The server's copy stays fresh for a minute; the banner shows when a later refresh fails.
  await Promise.all(
    [...route.queryClients].map(async (client) => {
      await client.invalidateQueries({ queryKey: [["project", "getById"]] });
    })
  );
  await expect
    .element(page.getByText("Could not refresh this project."))
    .toBeVisible();
});

test("project the account cannot open", async () => {
  await renderRoute(project, {
    ...request,
    server: { conversations: history },
  });
  await expect.element(page.getByText("Project unavailable")).toBeVisible();
});
