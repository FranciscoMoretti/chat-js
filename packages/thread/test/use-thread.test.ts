import { describe, expect, mock, test } from "bun:test";

import type { UIMessage } from "ai";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { getMessageText } from "../src/message-utils";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { Thread } from "../src/thread";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { MemoryThreadState } from "../src/thread-state";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { useThread } from "../src/use-thread";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { UseThreadHelpers, UseThreadOptions } from "../src/use-thread";
/* oxlint-enable import/no-relative-parent-imports */
import { ControlledTransport } from "./support/hook-controlled-transport";
import { RejectingTransport } from "./support/rejecting-transport";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { ResumeTransport } from "./support/resume-transport";
/* oxlint-enable import/max-dependencies */
import { StateBackedThread } from "./support/state-backed-thread";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const HookHarness = ({
  onCommit,
  onRender,
  options,
}: {
  onCommit?: (setMessages: UseThreadHelpers["setMessages"]) => void;
  onRender: (helpers: UseThreadHelpers) => void;
  options: UseThreadOptions;
}) => {
  const helpers = useThread(options);
  onRender(helpers);
  return createElement("div", {
    ref: () => onCommit?.(helpers.setMessages),
  });
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const renderUseThread = (
  initialOptions: UseThreadOptions,
  onCommit?: (setMessages: UseThreadHelpers["setMessages"]) => void
) => {
  let current: UseThreadHelpers | undefined;
  // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
  let renderer: ReactTestRenderer | undefined;
  const render = (options: UseThreadOptions) =>
    createElement(HookHarness, {
      onCommit,
      onRender: (helpers): void => {
        current = helpers;
      },
      options,
    });

  // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
  act((): void => {
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    renderer = create(render(initialOptions));
  });

  return {
    get current() {
      if (!current) {
        throw new Error("Expected useThread to render");
      }
      return current;
    },
    unmount(): void {
      // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
      act(() => {
        renderer?.unmount();
      });
    },
    update(options: UseThreadOptions): void {
      // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
      act(() => {
        renderer?.update(render(options));
      });
    },
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
describe("useThread", (): void => {
  test("observes messages sent through a custom state-backed AbstractThread", async (): Promise<void> => {
    const state = new MemoryThreadState<UIMessage>({
      messages: [user("user-1")],
    });
    const transport = new ControlledTransport();
    const thread = new StateBackedThread(state, transport);
    const hook = renderUseThread({ thread });

    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-1",
    ]);

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    act((): void => {
      thread.addMessage(user("user-2"), "user-1");
      thread.setCursor("user-2");
    });

    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-1",
      "user-2",
    ]);

    let send: Promise<void> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      send = hook.current.sendMessage({ text: "user-3" });
      await waitFor((): boolean => transport.requests.length === 1);
    });
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
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

    // oxlint-disable-next-line typescript/no-unsafe-argument -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-1",
      "user-2",
      expect.any(String),
      "assistant-1",
    ]);
    const response = hook.current.messages.at(-1);
    if (!response) {
      throw new Error("Expected a response message");
    }
    expect(getMessageText(response)).toBe("reply");
    hook.unmount();
  });

  test("forwards setters called by an initial commit ref", (): void => {
    let isFirstCommit = true;
    const hook = renderUseThread(
      { messages: [user("user-a")] },
      (setMessages): void => {
        if (isFirstCommit) {
          isFirstCommit = false;
          setMessages([user("user-b")]);
        }
      }
    );

    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-b",
    ]);
    hook.unmount();
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
    const hook = renderUseThread({
      id: "thread-1",
      onError: firstError,
      transport: firstTransport,
    });

    hook.update({
      id: "thread-1",
      onError: secondError,
      transport: secondTransport,
    });
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await hook.current.sendMessage({ text: "first request" });
    });

    expect(firstTransport.requests).toBe(1);
    expect(secondTransport.requests).toBe(0);
    expect(firstError).not.toHaveBeenCalled();
    expect(secondError).toHaveBeenCalledTimes(1);

    hook.update({
      id: "thread-2",
      messages: [user("user-2")],
      onError: secondError,
      transport: secondTransport,
    });
    expect(hook.current.id).toBe("thread-2");
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-2",
    ]);
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await hook.current.sendMessage({ text: "second request" });
    });

    expect(secondTransport.requests).toBe(1);
    hook.unmount();
  });

  test("resubscribes when the supplied thread changes", (): void => {
    const first = new Thread({ messages: [user("user-a")] });
    const second = new Thread({ messages: [user("user-b")] });
    const hook = renderUseThread({ thread: first });

    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-a",
    ]);
    hook.update({ thread: second });
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-b",
    ]);
    hook.unmount();
  });

  test("forwards a retained setter to the replacement supplied thread", (): void => {
    const first = new Thread({ messages: [user("user-a")] });
    const second = new Thread({ messages: [user("user-b")] });
    const hook = renderUseThread({ thread: first });
    const { setMessages } = hook.current;

    hook.update({ thread: second });
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    act((): void => {
      setMessages([user("user-c")]);
    });

    expect(first.getSnapshot().messages.map(({ id }): string => id)).toEqual([
      "user-a",
    ]);
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-c",
    ]);
    hook.unmount();
  });

  test("automatically resumes the supplied thread", async (): Promise<void> => {
    const transport = new ResumeTransport();
    const thread = new Thread({
      messages: [user("user-1"), assistant("assistant-1")],
      transport,
    });
    const hook = renderUseThread({ resume: true, thread });

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });

    expect(transport.reconnects).toBe(1);
    hook.unmount();
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
    const hook = renderUseThread({ resume: true, thread: first });

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });
    hook.update({ resume: true, thread: second });
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await Bun.sleep(0);
    });

    expect(firstTransport.reconnects).toBe(1);
    expect(secondTransport.reconnects).toBe(1);
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-2",
      "assistant-2",
    ]);
    hook.unmount();
  });

  test("keeps status immediate while throttling message snapshots", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const hook = renderUseThread({
      experimental_throttle: 100,
      messages: [user("user-1")],
      transport,
    });

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    act((): void => {
      hook.current.tree.setCursor("user-1");
    });

    let run:
      | Awaited<ReturnType<UseThreadHelpers["tree"]["startRun"]>>
      | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      run = await hook.current.tree.startRun({ from: "user-1" });
      await waitFor((): boolean => transport.requests.length === 1);
    });
    expect(hook.current.status).toBe("submitted");
    expect(hook.current.tree.status).toBe("submitted");

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
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
    expect(hook.current.messages.map(({ id }): string => id)).toEqual([
      "user-1",
    ]);

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      await Bun.sleep(110);
    });
    expect(
      getMessageText(
        hook.current.messages.find(({ id }): boolean => id === "assistant-1") ??
          assistant("missing")
      )
    ).toBe("streaming");

    // oxlint-disable-next-line typescript/no-deprecated -- React 19 deprecates react-test-renderer; this retained harness verifies hook commit, callback replacement, resume and throttling behavior. Harness migration is tracked in #622.
    await act(async (): Promise<void> => {
      transport.finish(0);
      await run?.finished;
    });
    expect(hook.current.status).toBe("ready");
    hook.unmount();
  });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
