import { createDomHarness } from "@/components/test-dom-harness";
import { EveLogicalResponses } from "@/components/eve/eve-logical-navigation";
import React, { act } from "react";
import { expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  const selectBranch = vi.fn<(_id: string) => void>(() => {
    emit();
  });
  const group: {
    groupId: string;
    slots: {
      operationId: string;
      modelId: string;
      selected: boolean;
      original?: { id: string };
    }[];
  } = {
    groupId: "group",
    slots: [{ operationId: "pending", modelId: "model", selected: false }],
  };
  const snapshot = { agents: new Map() };
  const controller = {
    getSnapshot: () => snapshot,
    logicalId: () => "user",
    selectBranch,
    selectNode: vi.fn<(_id: string) => void>(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { controller, emit, group, listeners, snapshot };
});

vi.mock("@/components/eve/eve-logical-context", () => ({
  useLogicalChat: () => ({
    controller: fixture.controller,
    snapshot: fixture.snapshot,
    ownerId: "owner",
  }),
}));
vi.mock("@/lib/eve/logical-response-slots", () => ({
  logicalResponseSlots: () => fixture.group,
}));
vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({
    getModelById: () => ({ id: "model", name: "Model" }),
  }),
}));
vi.mock("@/providers/default-model-provider", () => ({
  useModelChange: () =>
    vi.fn<(_id: string) => Promise<void>>().mockResolvedValue(),
}));
vi.mock("@/components/eve/eve-logical-group-recovery", () => ({
  EveLogicalGroupRecovery: ({
    autoOnly,
  }: {
    readonly autoOnly?: boolean;
  }): React.JSX.Element | null =>
    autoOnly === true ? null : <output>Recovering</output>,
}));
vi.mock("@/components/eve/eve-response-group-cards", () => ({
  EveResponseGroupCards: ({
    onSelect,
    selectedOperationId,
  }: {
    readonly onSelect: (id: string) => void;
    readonly selectedOperationId: string | null;
  }): React.JSX.Element => (
    <>
      <output>{selectedOperationId ?? "none"}</output>
      <button
        type="button"
        onClick={() => {
          onSelect("pending");
        }}
      >
        Select
      </button>
    </>
  ),
}));

it("confirms a pending response once, clears it before recursive selection events, and unsubscribes", (): void => {
  let harness: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    harness = createDomHarness(
      <EveLogicalResponses
        conversationId="conversation"
        messageId="message"
        disabled={false}
      />
    );
  });
  if (!harness) {
    throw new Error("Missing response harness");
  }
  const rendered = harness;
  try {
    act(() => {
      const button = rendered.container.querySelector("button");
      if (!button) {
        throw new Error("Missing selection button");
      }
      button.click();
    });
    expect(rendered.container.textContent).toContain("Recovering");
    expect(fixture.controller.selectBranch).not.toHaveBeenCalled();
    act(() => {
      fixture.group.slots = [
        {
          operationId: "pending",
          modelId: "model",
          selected: true,
          original: { id: "accepted" },
        },
      ];
      fixture.emit();
    });
    expect(fixture.controller.selectBranch).toHaveBeenCalledExactlyOnceWith(
      "accepted"
    );
    expect(rendered.container.textContent).not.toContain("Recovering");
    act(() => {
      fixture.group.slots = [
        { operationId: "pending", modelId: "model", selected: false },
      ];
      fixture.emit();
      rendered.update(
        <EveLogicalResponses
          conversationId="conversation"
          messageId="message"
          disabled={false}
        />
      );
    });
    expect(rendered.container.textContent).not.toContain("Recovering");
    expect(fixture.controller.selectBranch).toHaveBeenCalledTimes(1);
    act(() => {
      fixture.group.slots = [
        {
          operationId: "pending",
          modelId: "model",
          selected: false,
          original: { id: "accepted" },
        },
      ];
      fixture.controller = { ...fixture.controller };
      rendered.update(
        <EveLogicalResponses
          conversationId="conversation"
          messageId="message"
          disabled={false}
        />
      );
    });
    expect(fixture.controller.selectBranch).toHaveBeenCalledTimes(1);
  } finally {
    act(() => {
      rendered.unmount();
    });
  }
  expect(fixture.listeners.size).toBe(0);
});
