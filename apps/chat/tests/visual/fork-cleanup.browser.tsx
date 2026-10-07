/* oxlint-disable react/jsx-no-literals -- Fixed fixture labels and expected recovery copy form the accessible browser scenario; no translation API exists in the fixture. */
/* oxlint-disable max-statements -- This integration scenario keeps the rejected request, visible recovery and storage-only retry assertions in one lifecycle. */
/* oxlint-disable oxc/no-async-await -- Await native browser interactions, React commits, snapshot completion and cleanup in their original order. */
/* oxlint-disable sort-imports -- Oxfmt groups runtime, type and CSS imports by module; this grouping conflicts with sort-imports binding-syntax order. */
import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { EveForkRecovery } from "@/components/eve/eve-fork-recovery";
import { useEveFork } from "@/components/eve/use-eve-fork";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({
  openRuntime: vi.fn(),
  resolveCreationRequest: vi.fn(),
  restoreAttachments: vi.fn(),
}));
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/components/eve/eve-logical-context", () => ({
  useEveRuntime: () => mocks.openRuntime,
}));
/* oxlint-enable typescript/explicit-function-return-type */

vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: mocks.resolveCreationRequest,
}));
/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/features/installed-uploads", () => ({
  attachmentUploads: {
    controls: [],
    useUploads: () => ({
      uploadQueue: [],
    }),
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "openai/gpt-4.1",
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

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
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/only-export-components -- This browser entrypoint mounts its local fixture; exporting it creates an unused test API. */
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

/* oxlint-enable react/only-export-components */
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

/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
/* oxlint-enable react/jsx-no-literals */
