import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { beforeEach, expect, test } from "vitest";
import { commands, page } from "vitest/browser";

import { EveRuntimeRoute } from "@/components/eve/eve-runtime-provider";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import {
  getServerCalls,
  setServerRegistration,
} from "@/tests/visual/native-eve-services";
import { unmount } from "@/tests/visual/primitive-mount";
import { RegisteredEveProjects } from "@/tests/visual/registered-projects";

beforeEach((): void => {
  localStorage.clear();
});
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

    await act(
      /* oxlint-disable eslint/require-await -- React act uses its asynchronous overload for rendering completion even though this fixture update itself is synchronous; no unrelated await is inserted. */
      async () => {
        state.rejectIdentity();
      }
      /* oxlint-enable eslint/require-await */
    );
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Fixture unavailable");
    await takeSnapshot("route-failure");
  } finally {
    await unmount(state.fixture);
    state.queryClient.clear();
  }
});
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
const serverRegistrations: readonly ("registered" | "missing")[] = [
  "registered",
  "missing",
];
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
