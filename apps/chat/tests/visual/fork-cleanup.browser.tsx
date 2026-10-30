import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { EveForkRecovery } from "@/components/eve/eve-fork-recovery";
import { useEveFork } from "@/components/eve/use-eve-fork";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";

const mocks = vi.hoisted(() => ({
  openRuntime: vi.fn(),
  resolveCreationRequest: vi.fn(),
  restoreAttachments: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mocks.restoreAttachments }),
  useQuery: () => ({
    data: {
      branches: [
        {
          forkTurnId: null,
          id: "11111111-1111-4111-8111-111111111111",
          parentConversationId: null,
        },
      ],
    },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/eve/eve-logical-context", () => ({
  useEveRuntime: () => mocks.openRuntime,
}));

vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: mocks.resolveCreationRequest,
}));

vi.mock("@/integrations/uploads", () => ({
  attachmentUploads: {
    controls: [],
    useUploads: () => ({
      uploadQueue: [],
    }),
  },
}));

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "openai/gpt-4.1",
}));

vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({
    eve: {
      branches: {
        pathKey: () => ["eve", "branches"],
        queryOptions: () => ({}),
      },
      list: {
        pathKey: () => ["eve", "list"],
      },
      restoreAttachments: { mutationOptions: () => ({}) },
    },
  }),
}));

const ForkFixture = (): React.JSX.Element => {
  const fork = useEveFork("test-owner", "11111111-1111-4111-8111-111111111111");
  return (
    <main className="p-8">
      <button
        type="button"
        onClick={() => {
          void fork.begin({
            id: "seed_message_0",
            parts: [{ text: "Find the answer", type: "text" }],
            role: "user",
          });
        }}
      >
        Edit response
      </button>
      <button
        type="button"
        onClick={() => {
          void fork.submit();
        }}
      >
        Submit version
      </button>
      <EveForkRecovery fork={fork} />
    </main>
  );
};

test("rejected fork cleanup remains visible and retries only storage removal", async () => {
  sessionStorage.clear();
  mocks.resolveCreationRequest.mockRejectedValue(
    new CreationRejectedError("Source unavailable")
  );
  const removal = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
  const fixture = await mount(<ForkFixture />);
  try {
    await page.getByRole("button", { name: "Edit response" }).click();
    await page.getByRole("button", { name: "Submit version" }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent(
        "The rejected version request could not be cleared. Keep this tab for recovery."
      );
    await expect
      .element(page.getByRole("button", { name: "Clear rejected request" }))
      .toBeEnabled();
    await expect
      .element(page.getByRole("button", { name: "Recover version" }))
      .not.toBeInTheDocument();
    await takeSnapshot("fork-rejected-cleanup");
    await page.getByRole("region", { name: "Version recovery" }).screenshot();
    await page.getByRole("button", { name: "Clear rejected request" }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent(
        "The rejected version request could not be cleared. Keep this tab for recovery."
      );
    expect(mocks.resolveCreationRequest).toHaveBeenCalledOnce();
    removal.mockRestore();
    await page.getByRole("button", { name: "Clear rejected request" }).click();
    await expect
      .element(page.getByRole("region", { name: "Version recovery" }))
      .not.toBeInTheDocument();
    expect(mocks.resolveCreationRequest).toHaveBeenCalledOnce();
  } finally {
    removal.mockRestore();
    sessionStorage.clear();
    await unmount(fixture);
  }
});
