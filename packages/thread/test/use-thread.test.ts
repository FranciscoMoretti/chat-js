import {
  afterAll,
  afterEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import type { UIMessage } from "ai";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { getMessageText } from "#thread-source/message-utils";
import type { ReadonlyMessageValue } from "#thread-source/message-utils";
import { Thread } from "#thread-source/thread";
import { MemoryThreadState } from "#thread-source/thread-state";
import type {
  UseThreadHelpers,
  UseThreadOptions,
} from "#thread-source/use-thread";

import { ControlledTransport } from "./support/hook-controlled-transport";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { createHookDom } from "./support/hook-dom";
import { RejectingTransport } from "./support/rejecting-transport";
import { ResumeTransport } from "./support/resume-transport";
import { StateBackedThread } from "./support/state-backed-thread";
/* oxlint-enable import/max-dependencies */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// Install the DOM before loading the hook so its isomorphic effect uses the
// browser commit lifecycle. Restore globals after this suite, including act.
const dom = createHookDom();
// oxlint-disable-next-line node/no-top-level-await -- This Bun hook suite loads useThread after installing its browser globals and DOM lifecycle fixture.
const { useThread } = await import("#thread-source/use-thread");
const roots = new Set<Root>();
const NO_ERRORS = 0;

// Use React's asynchronous act path even for synchronous actions. The microtask
// boundary lets act flush effects and any updates scheduled by the commit.
const commit = async (action: () => void): Promise<void> => {
  await act(async (): Promise<void> => {
    action();
    await Promise.resolve();
  });
};

afterEach(async (): Promise<void> => {
  try {
    await commit((): void => {
      const errors: unknown[] = [];
      for (const root of roots) {
        try {
          root.unmount();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > NO_ERRORS) {
        throw new AggregateError(errors, "Failed to unmount hook test roots");
      }
    });
  } finally {
    roots.clear();
    globalThis.document.body.replaceChildren();
  }
});

afterAll(async (): Promise<void> => {
  await dom.close();
});

const user = (id: string): UIMessage => ({
  id,
  parts: [{ text: id, type: "text" }],
  role: "user",
});

const assistant = (id: string): UIMessage => ({
  id,
  parts: [],
  role: "assistant",
});

type TreeCollectionKeys =
  | "activeRuns"
  | "childrenByParentId"
  | "messagesById"
  | "parentById"
  | "rootIds"
  | "runs";
type HookResultReader = Readonly<
  Omit<UseThreadHelpers, "messages" | "error" | "tree">
> &
  ReadonlyMessageValue<Pick<UseThreadHelpers, "messages" | "error">> & {
    readonly tree: Readonly<
      Omit<UseThreadHelpers["tree"], TreeCollectionKeys>
    > &
      ReadonlyMessageValue<Pick<UseThreadHelpers["tree"], TreeCollectionKeys>>;
  };

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The harness forwards native SDK options or a supplied AbstractThread identity to useThread; a deep readonly option view fails that actual hook receiver, while callback helpers are readonly readers.
const HookHarness = ({
  onCommit,
  onRender,
  options,
}: Readonly<{
  onCommit?: (setMessages: UseThreadHelpers["setMessages"]) => void;
  onRender: (helpers: HookResultReader) => void;
  options: Readonly<UseThreadOptions>;
}>) => {
  const helpers = useThread(options);
  onRender(helpers);
  return createElement("div", {
    ref: () => onCommit?.(helpers.setMessages),
  });
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
const renderUseThread = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Initial options are forwarded through React props into the native useThread constructor/controller contract; deeply readonly SDK schemas or private controller views are not assignable.
  initialOptions: Readonly<UseThreadOptions>,
  onCommit?: (setMessages: UseThreadHelpers["setMessages"]) => void
) => {
  let current: HookResultReader | undefined;
  const container = globalThis.document.createElement("div");
  globalThis.document.body.append(container);
  const renderer = createRoot(container);
  roots.add(renderer);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- React renders the original hook options, including native SDK schemas or the supplied controller class; the deep readonly alternative fails useThread receiving those props.
  const render = (options: Readonly<UseThreadOptions>) =>
    createElement(HookHarness, {
      onCommit,
      onRender: (helpers): void => {
        current = helpers;
      },
      options,
    });

  await commit((): void => {
    renderer.render(render(initialOptions));
  });

  return {
    get current() {
      if (!current) {
        throw new Error("Expected useThread to render");
      }
      return current;
    },
    async unmount(): Promise<void> {
      try {
        await commit((): void => {
          renderer.unmount();
        });
      } finally {
        roots.delete(renderer);
        container.remove();
      }
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Updating the renderer forwards original native hook construction options or a supplied controller; deep readonly options fail the same concrete useThread receiver.
    async update(options: Readonly<UseThreadOptions>): Promise<void> {
      await commit((): void => {
        renderer.render(render(options));
      });
    },
  };
};
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
const waitFor = async (
  predicate: () => boolean,
  attemptsRemaining = 500
): Promise<void> => {
  if (predicate()) {
    return;
  }
  if (attemptsRemaining === 0) {
    throw new Error("Timed out waiting for condition");
  }
  await Bun.sleep(1);
  await waitFor(predicate, attemptsRemaining - 1);
};
/* oxlint-enable eslint/no-magic-numbers */

const trackSubscriptions = (
  thread: Readonly<Pick<Thread, "subscribe">>
): Set<() => void> => {
  const listeners = new Set<() => void>();
  const { subscribe } = thread;
  Object.defineProperty(thread, "subscribe", {
    value: (listener: () => void): (() => void) => {
      listeners.add(listener);
      const unsubscribe = subscribe(listener);
      return (): void => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
  });
  return listeners;
};

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
describe("useThread", (): void => {
  test("observes messages sent through a custom state-backed AbstractThread", async (): Promise<void> => {
    const state = new MemoryThreadState<UIMessage>({
      messages: [user("user-1")],
    });
    const transport = new ControlledTransport();
    const thread = new StateBackedThread(state, transport);
    const hook = await renderUseThread({ thread });

    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1"]);

    await commit((): void => {
      thread.addMessage(user("user-2"), "user-1");
      thread.setCursor("user-2");
    });

    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1", "user-2"]);

    let send: Promise<void> | undefined;
    await act(async (): Promise<void> => {
      send = hook.current.sendMessage({ text: "user-3" });
      await waitFor((): boolean => transport.requests.length === 1);
    });
    await act(async (): Promise<void> => {
      transport.emit(0, { messageId: "assistant-1", type: "start" });
      transport.emit(0, { id: "text", type: "text-start" });
      transport.emit(0, {
        delta: "reply",
        id: "text",
        type: "text-delta",
      });
      transport.emit(0, { id: "text", type: "text-end" });
      transport.finish(0);
      await send;
    });

    const messageIds = hook.current.messages.map(
      ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
    );
    expect(messageIds).toHaveLength(4);
    expect(messageIds.slice(0, 2)).toEqual(["user-1", "user-2"]);
    expect(typeof messageIds[2]).toBe("string");
    expect(messageIds[3]).toBe("assistant-1");
    const response = hook.current.messages.at(-1);
    if (!response) {
      throw new Error("Expected a response message");
    }
    expect(getMessageText(response)).toBe("reply");
    await hook.unmount();
  });

  test("forwards setters called by an initial commit ref", async (): Promise<void> => {
    let isFirstCommit = true;
    const hook = await renderUseThread(
      { messages: [user("user-a")] },
      (setMessages): void => {
        if (isFirstCommit) {
          isFirstCommit = false;
          setMessages([user("user-b")]);
        }
      }
    );

    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-b"]);
    await hook.unmount();
  });
  test("uses current callbacks without replacing the chat transport", async (): Promise<void> => {
    const firstTransport = new RejectingTransport();
    const secondTransport = new RejectingTransport();
    const firstError = mock((): void => {
      /* Ignore transport errors while checking callback replacement. */
    });
    const secondError = mock((): void => {
      /* Ignore transport errors while checking callback replacement. */
    });
    const hook = await renderUseThread({
      id: "thread-1",
      onError: firstError,
      transport: firstTransport,
    });

    await hook.update({
      id: "thread-1",
      onError: secondError,
      transport: secondTransport,
    });
    await act(async (): Promise<void> => {
      await hook.current.sendMessage({ text: "first request" });
    });

    expect(firstTransport.requests).toBe(1);
    expect(secondTransport.requests).toBe(0);
    expect(firstError).not.toHaveBeenCalled();
    expect(secondError).toHaveBeenCalledTimes(1);

    await hook.update({
      id: "thread-2",
      messages: [user("user-2")],
      onError: secondError,
      transport: secondTransport,
    });
    expect(hook.current.id).toBe("thread-2");
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-2"]);
    await act(async (): Promise<void> => {
      await hook.current.sendMessage({ text: "second request" });
    });

    expect(secondTransport.requests).toBe(1);
    await hook.unmount();
  });

  test("resubscribes when the supplied thread changes", async (): Promise<void> => {
    const first = new Thread({ messages: [user("user-a")] });
    const second = new Thread({ messages: [user("user-b")] });
    const firstListeners = trackSubscriptions(first);
    const secondListeners = trackSubscriptions(second);
    const hook = await renderUseThread({ thread: first });

    expect(firstListeners.size).toBeGreaterThan(0);
    expect(secondListeners.size).toBe(0);
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-a"]);
    await hook.update({ thread: second });
    expect(firstListeners.size).toBe(0);
    expect(secondListeners.size).toBeGreaterThan(0);
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-b"]);
    await commit((): void => {
      first.setMessages([user("old-thread-update")]);
      second.setMessages([user("new-thread-update")]);
    });
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["new-thread-update"]);
    await hook.unmount();
    expect(firstListeners.size).toBe(0);
    expect(secondListeners.size).toBe(0);
  });

  test("forwards a retained setter to the replacement supplied thread", async (): Promise<void> => {
    const first = new Thread({ messages: [user("user-a")] });
    const second = new Thread({ messages: [user("user-b")] });
    const hook = await renderUseThread({ thread: first });
    const { setMessages } = hook.current;

    await hook.update({ thread: second });
    await commit((): void => {
      setMessages([user("user-c")]);
    });

    expect(
      first
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-a"]);
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-c"]);
    await hook.unmount();
  });

  test("automatically resumes the supplied thread", async (): Promise<void> => {
    const transport = new ResumeTransport();
    const thread = new Thread({
      messages: [user("user-1"), assistant("assistant-1")],
      transport,
    });
    const hook = await renderUseThread({ resume: true, thread });

    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });

    expect(transport.reconnects).toBe(1);
    await hook.unmount();
  });

  test("resumes a replacement supplied thread while resume remains enabled", async (): Promise<void> => {
    const firstTransport = new ResumeTransport();
    const secondTransport = new ResumeTransport();
    const first = new Thread({
      messages: [user("user-1"), assistant("assistant-1")],
      transport: firstTransport,
    });
    const second = new Thread({
      messages: [user("user-2"), assistant("assistant-2")],
      transport: secondTransport,
    });
    const hook = await renderUseThread({ resume: true, thread: first });

    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });
    await hook.update({ resume: true, thread: second });
    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });

    expect(firstTransport.reconnects).toBe(1);
    expect(secondTransport.reconnects).toBe(1);
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-2", "assistant-2"]);
    await hook.unmount();
  });

  test("keeps status immediate while throttling message snapshots", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const hook = await renderUseThread({
      experimental_throttle: 100,
      messages: [user("user-1")],
      transport,
    });

    await commit((): void => {
      hook.current.tree.setCursor("user-1");
    });

    let run:
      | Awaited<ReturnType<UseThreadHelpers["tree"]["startRun"]>>
      | undefined;
    await act(async (): Promise<void> => {
      run = await hook.current.tree.startRun({ from: "user-1" });
      await waitFor((): boolean => transport.requests.length === 1);
    });
    expect(hook.current.status).toBe("submitted");
    expect(hook.current.tree.status).toBe("submitted");

    await act(async (): Promise<void> => {
      transport.emit(0, { messageId: "assistant-1", type: "start" });
      transport.emit(0, { id: "text", type: "text-start" });
      transport.emit(0, {
        delta: "streaming",
        id: "text",
        type: "text-delta",
      });
      await Bun.sleep(0);
    });
    expect(hook.current.status).toBe("streaming");
    expect(hook.current.tree.status).toBe("streaming");
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1"]);

    await act(async (): Promise<void> => {
      await Bun.sleep(110);
    });
    expect(
      getMessageText(
        hook.current.messages.find(({ id }): boolean => id === "assistant-1") ??
          assistant("missing")
      )
    ).toBe("streaming");

    await act(async (): Promise<void> => {
      transport.finish(0);
      await run?.finished;
    });
    expect(hook.current.status).toBe("ready");
    await hook.unmount();
  });
  test("cancels pending throttled notifications on unmount", async (): Promise<void> => {
    const thread = new Thread({ messages: [user("user-a")] });
    const listeners = trackSubscriptions(thread);
    const getSnapshot = mock(thread.getSnapshot);
    thread.getSnapshot = getSnapshot;
    const hook = await renderUseThread({ experimental_throttle: 100, thread });

    const now = spyOn(Date, "now").mockReturnValue(1000);
    try {
      await commit((): void => {
        thread.setMessages([user("user-b")]);
      });
      expect(
        hook.current.messages.map(
          ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
        )
      ).toEqual(["user-b"]);
      await act(async (): Promise<void> => {
        // Freeze elapsed time and unmount before yielding so a slow runner
        // cannot publish the second snapshot or run its pending timer first.
        thread.setMessages([user("user-c")]);
        expect(
          hook.current.messages.map(
            ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
          )
        ).toEqual(["user-b"]);
        await hook.unmount();
      });
    } finally {
      now.mockRestore();
    }
    expect(listeners.size).toBe(0);
    getSnapshot.mockClear();

    await act(async (): Promise<void> => {
      thread.setMessages([user("after-unmount")]);
      await Bun.sleep(110);
    });
    // A leaked throttle timer would read the snapshot even after unsubscribing.
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(
      hook.current.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-b"]);
  });
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
