import { describe, expect, mock, test } from "bun:test";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMessageText } from "../src/message-utils";
import { Thread } from "../src/thread";
import {
	type UseThreadHelpers,
	type UseThreadOptions,
	useThread,
} from "../src/use-thread";

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class RejectingTransport implements ChatTransport<UIMessage> {
	requests = 0;

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = () => {
		this.requests += 1;
		return Promise.reject(new Error("transport failed"));
	};

	reconnectToStream() {
		return Promise.resolve(null);
	}
}

class ControlledTransport implements ChatTransport<UIMessage> {
	readonly requests: Array<ReadableStreamDefaultController<UIMessageChunk>> =
		[];

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
		Promise.resolve(
			new ReadableStream({
				start: (controller) => {
					this.requests.push(controller);
				},
			}),
		);

	reconnectToStream() {
		return Promise.resolve(null);
	}

	emit(requestIndex: number, chunk: UIMessageChunk) {
		this.requests[requestIndex]?.enqueue(chunk);
	}

	finish(requestIndex: number) {
		this.requests[requestIndex]?.close();
	}
}

class ResumeTransport implements ChatTransport<UIMessage> {
	reconnects = 0;

	sendMessages() {
		throw new Error("Unexpected send");
	}

	reconnectToStream() {
		this.reconnects += 1;
		return Promise.resolve(null);
	}
}

function user(id: string): UIMessage {
	return { id, parts: [{ text: id, type: "text" }], role: "user" };
}

function assistant(id: string): UIMessage {
	return { id, parts: [], role: "assistant" };
}

function HookHarness({
	onRender,
	options,
}: {
	onRender: (helpers: UseThreadHelpers) => void;
	options: UseThreadOptions;
}) {
	onRender(useThread(options));
	return null;
}

function renderUseThread(initialOptions: UseThreadOptions) {
	let current: UseThreadHelpers | undefined;
	let renderer: ReactTestRenderer | undefined;
	const render = (options: UseThreadOptions) =>
		createElement(HookHarness, {
			onRender: (helpers) => {
				current = helpers;
			},
			options,
		});

	act(() => {
		renderer = create(render(initialOptions));
	});

	return {
		get current() {
			if (!current) throw new Error("Expected useThread to render");
			return current;
		},
		unmount() {
			act(() => renderer?.unmount());
		},
		update(options: UseThreadOptions) {
			act(() => renderer?.update(render(options)));
		},
	};
}

async function waitFor(predicate: () => boolean) {
	for (let attempt = 0; attempt < 500; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(1);
	}
	throw new Error("Timed out waiting for condition");
}

describe("useThread", () => {
	test("uses current callbacks without replacing the thread transport", async () => {
		const firstTransport = new RejectingTransport();
		const secondTransport = new RejectingTransport();
		const firstError = mock(() => {});
		const secondError = mock(() => {});
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
		await act(async () => {
			await hook.current.sendMessage({ text: "first request" });
		});

		expect(firstTransport.requests).toBe(1);
		expect(secondTransport.requests).toBe(0);
		expect(firstError).not.toHaveBeenCalled();
		expect(secondError).toHaveBeenCalledTimes(1);

		hook.update({
			id: "thread-2",
			onError: secondError,
			transport: secondTransport,
		});
		await act(async () => {
			await hook.current.sendMessage({ text: "second request" });
		});

		expect(hook.current.id).toBe("thread-2");
		expect(secondTransport.requests).toBe(1);
		hook.unmount();
	});

	test("resubscribes when the supplied thread changes", () => {
		const first = new Thread({ messages: [user("user-a")] });
		const second = new Thread({ messages: [user("user-b")] });
		const hook = renderUseThread({ thread: first });

		expect(hook.current.messages.map(({ id }) => id)).toEqual(["user-a"]);
		hook.update({ thread: second });
		expect(hook.current.messages.map(({ id }) => id)).toEqual(["user-b"]);
		hook.unmount();
	});

	test("automatically resumes the supplied thread", async () => {
		const transport = new ResumeTransport();
		const thread = new Thread({
			messages: [user("user-1"), assistant("assistant-1")],
			transport,
		});
		const hook = renderUseThread({ thread, resume: true });

		await act(async () => {
			await Bun.sleep(0);
		});

		expect(transport.reconnects).toBe(1);
		hook.unmount();
	});

	test("keeps status immediate while throttling message snapshots", async () => {
		const transport = new ControlledTransport();
		const hook = renderUseThread({
			experimental_throttle: 100,
			messages: [user("user-1")],
			transport,
		});

		act(() => hook.current.tree.setCursor("user-1"));

		let run:
			| Awaited<ReturnType<UseThreadHelpers["tree"]["startRun"]>>
			| undefined;
		await act(async () => {
			run = await hook.current.tree.startRun({ from: "user-1" });
			await waitFor(() => transport.requests.length === 1);
		});
		expect(hook.current.status).toBe("submitted");
		expect(hook.current.tree.status).toBe("submitted");

		await act(async () => {
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
		expect(hook.current.messages.map(({ id }) => id)).toEqual(["user-1"]);

		await act(async () => {
			await Bun.sleep(110);
		});
		expect(
			getMessageText(
				hook.current.messages.find(({ id }) => id === "assistant-1") ??
					assistant("missing"),
			),
		).toBe("streaming");

		await act(async () => {
			transport.finish(0);
			await run?.finished;
		});
		expect(hook.current.status).toBe("ready");
		hook.unmount();
	});
});
