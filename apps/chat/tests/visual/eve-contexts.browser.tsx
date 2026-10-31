import type * as SessionModule from "@/providers/session-provider";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";

import { EveRuntimeRoute } from "@/components/eve/eve-runtime-provider";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";
import { SidebarSections } from "@/components/chat-slots";

const registrationState = vi.hoisted(() => ({ present: true }));
vi.mock("@/providers/session-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  useSession: () => ({
    data: registrationState.present ? { user: { id: "fixture-user" } } : null,
    isPending: false,
  }),
}));

beforeEach((): void => {
  localStorage.clear();
  registrationState.present = true;
});
for (const scene of [
  { name: "welcome", projectId: "" },
  { name: "project", projectId: "00000000-0000-4000-8000-000000000001" },
]) {
  test(`native new conversation ${scene.name}`, async () => {
    await commands.modelAssets();
    const state = await mountNative(
      <div className="mx-auto flex min-h-0 w-full flex-col p-2 md:max-w-3xl">
        <NewEveConversation
          ownerId="fixture-user"
          creationInput={
            scene.projectId ? { projectId: scene.projectId } : undefined
          }
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

    await act<undefined>(() => {
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
  test(`native plugin projects ${registration}`, async () => {
    registrationState.present = registration === "registered";
    const state = await mountNative(<SidebarSections />);
    try {
      await verifyServerProjects(registration, state.requests);
      await takeSnapshot(`server-projects-${registration}`);
    } finally {
      await unmount(state.fixture);
      state.queryClient.clear();
    }
  });
}
