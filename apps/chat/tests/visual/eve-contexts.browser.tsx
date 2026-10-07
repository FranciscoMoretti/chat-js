import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { beforeEach, expect, test } from "vitest";
import { commands, page } from "vitest/browser";

import { EveRuntimeRoute } from "@/components/eve/eve-runtime-provider";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import { mountNative } from "@/tests/visual/native-eve-fixture";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import {
  getServerCalls,
  setServerRegistration,
} from "@/tests/visual/native-eve-services";
/* oxlint-enable sort-imports */
import { unmount } from "@/tests/visual/primitive-mount";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { RegisteredEveProjects } from "@/tests/visual/registered-projects";
/* oxlint-enable sort-imports */

beforeEach((): void => {
  localStorage.clear();
});
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
for (const scene of [
  { name: "welcome", projectId: "" },
  { name: "project", projectId: "fixture-project" },
]) {
  test(`native new conversation ${scene.name}`, async () => {
    await commands.modelAssets();
    const state = await mountNative(
      <div className="mx-auto flex min-h-0 w-full flex-col p-2 md:max-w-3xl">
        <NewEveConversation
          ownerId="fixture-user"
          projectId={scene.projectId}
        />
      </div>
    );
    try {
      await expect.element(page.getByRole("textbox")).toBeVisible();
      await expect
        .poll(
          () =>
            page
              .getByRole("heading", { name: "How can I help you today?" })
              .query() !== null
        )
        .toBe(scene.name === "welcome");
      await takeSnapshot(`new-conversation-${scene.name}`);
    } finally {
      await unmount(state.fixture);
      state.queryClient.clear();
    }
  });
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
test("native route loading and identity failure", async () => {
  const state = await mountNative(
    <EveRuntimeRoute
      chatId="fixture-chat"
      id="fixture-chat"
      ownerId="fixture-user"
      sessionId="fixture-session"
    />
  );
  try {
    await expect
      .element(page.getByLabelText("Loading conversation"))
      .toBeVisible();
    await expect.poll(() => state.requests.includes("eve.get")).toBe(true);
    await takeSnapshot("route-loading");
    // oxlint-disable-next-line eslint/require-await, typescript/require-await -- React act and native asynchronous auth/header APIs expose completion promises even when the fixture operation is synchronous.
    await act(async () => {
      state.rejectIdentity();
    });
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Fixture unavailable");
    await takeSnapshot("route-failure");
  } finally {
    await unmount(state.fixture);
    state.queryClient.clear();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
const verifyServerProjects = async (
  registration: string,
  requests: readonly string[]
): Promise<void> => {
  if (registration === "registered") {
    await expect
      .element(page.getByText("Projects", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("New project", { exact: true }))
      .toBeVisible();
    return;
  }
  await expect
    .element(page.getByText("Projects", { exact: true }))
    .not.toBeInTheDocument();
  expect(requests).not.toContain("project.list");
};
/* oxlint-enable oxc/no-async-await */
const serverRegistrations: readonly ("registered" | "missing")[] = [
  "registered",
  "missing",
];
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
for (const registration of serverRegistrations) {
  test(`native server projects ${registration}`, async () => {
    setServerRegistration(registration);
    const projects = await RegisteredEveProjects();
    expect(getServerCalls()).toEqual(["headers", `auth:${registration}`]);
    const state = await mountNative(projects);
    try {
      await verifyServerProjects(registration, state.requests);
      await takeSnapshot(`server-projects-${registration}`);
    } finally {
      await unmount(state.fixture);
      state.queryClient.clear();
    }
  });
}
/* oxlint-enable oxc/no-async-await */
