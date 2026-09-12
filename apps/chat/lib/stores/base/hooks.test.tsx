import type { UIMessage } from "ai";
import { act, create } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import {
  createChatStore,
  Provider,
  useChatActions,
  useChatStatus,
  useChatStore,
} from "./hooks";
import type { StoreState } from "./hooks";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type LabeledMessage = UIMessage<{ label: string }>;

const MessageLabel = () => {
  const label = useChatStore(
    (state: StoreState<LabeledMessage>) => state.messages[0]?.metadata?.label
  );
  return <output>{label}</output>;
};

const FullState = () => {
  const state = useChatStore<LabeledMessage>();
  return (
    <output>{`${state.status}:${state.messages[0]?.metadata?.label}`}</output>
  );
};

const Status = () => <output>{useChatStatus()}</output>;

const ChatActionsProbe = ({
  onActions,
}: {
  onActions: (actions: ReturnType<typeof useChatActions>) => void;
}) => {
  onActions(useChatActions());
  return null;
};

const message: LabeledMessage = {
  id: "message-1",
  metadata: { label: "initial" },
  parts: [],
  role: "assistant",
};

describe("chat store hooks", () => {
  it("keeps the unconfigured startRun fallback asynchronous", async () => {
    const store = createChatStore<LabeledMessage>([]);
    let actions: ReturnType<typeof useChatActions> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <Provider store={store}>
          <ChatActionsProbe onActions={(value) => (actions = value)} />
        </Provider>
      );
    });

    const rendered = renderer;
    if (!rendered || !actions) {
      throw new Error("Expected chat actions to be available");
    }

    try {
      const startRun = Reflect.apply(actions.startRun, undefined, []);
      await expect(startRun).rejects.toThrow("startRun not configured");
    } finally {
      act(() => rendered.unmount());
    }
  });

  it("subscribes to selected typed message data and the full store", () => {
    const store = createChatStore<LabeledMessage>([message]);
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <Provider store={store}>
          <MessageLabel />
          <FullState />
          <Status />
        </Provider>
      );
    });
    if (!renderer) {
      throw new Error("Expected hook harness to render");
    }
    const rendered = renderer;
    try {
      expect(
        rendered.root.findAllByType("output").map((node) => node.children)
      ).toEqual([["initial"], ["ready:initial"], ["ready"]]);
      act(() => {
        store.getState().setStatus("streaming");
        store
          .getState()
          .setMessages([{ ...message, metadata: { label: "updated" } }]);
      });
      expect(
        rendered.root.findAllByType("output").map((node) => node.children)
      ).toEqual([["updated"], ["streaming:updated"], ["streaming"]]);
      act(() => store.getState().reset());
      expect(
        rendered.root.findAllByType("output").map((node) => node.children)
      ).toEqual([[], ["ready:undefined"], ["ready"]]);
    } finally {
      act(() => rendered.unmount());
    }
  });

  it("keeps separate providers subscribed to their own stores", () => {
    const first = createChatStore<LabeledMessage>([message]);
    const second = createChatStore<LabeledMessage>([
      { ...message, metadata: { label: "second" } },
    ]);
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <>
          <Provider store={first}>
            <MessageLabel />
          </Provider>
          <Provider store={second}>
            <MessageLabel />
          </Provider>
        </>
      );
    });
    if (!renderer) {
      throw new Error("Expected hook harness to render");
    }
    const rendered = renderer;
    try {
      act(() =>
        first
          .getState()
          .setMessages([{ ...message, metadata: { label: "changed" } }])
      );
      expect(
        rendered.root.findAllByType("output").map((node) => node.children)
      ).toEqual([["changed"], ["second"]]);
    } finally {
      act(() => rendered.unmount());
    }
  });
});
