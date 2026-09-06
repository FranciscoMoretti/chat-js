"use client";
// Test host only. Copied into a temporary Next route by proof.ts and removed afterward.
import type { ChatTransport, UIMessageChunk } from "ai";
import { useState, useSyncExternalStore } from "react";
import {
	ConversationView,
	useConversationView,
} from "@/components/chat/conversation-view";
import { MessagesPane } from "@/components/messages-pane";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import { ApplicationThread } from "@/lib/application-thread";
import { useChatStatus } from "@/lib/chat/view-hooks";
import {
	CustomStoreProvider,
	createCustomChatStore,
} from "@/lib/stores/custom-store-provider";
import { ZustandThreadState } from "@/lib/stores/zustand-thread-state";
import {
	ChatInputProvider,
	useChatInput,
} from "@/providers/chat-input-provider";

function message(
	id: string,
	role: "user" | "assistant",
	parentMessageId: string | null,
): ChatMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text: id }],
		metadata: {
			createdAt: new Date("2026-09-06"),
			selectedModel: "openai/gpt-5-mini",
			parentMessageId,
			activeStreamId: null,
		},
	};
}
function fixture() {
	const store = createCustomChatStore<ChatMessage>(
		[message("root", "user", null)],
		{ initialIsChatPersisted: true },
	);
	const thread = new ApplicationThread({
		id: "00000000-0000-4000-8000-000000000004",
		state: new ZustandThreadState(store),
	});
	thread.addMessage(message("branch-a", "assistant", "root"), "root");
	thread.addMessage(message("branch-b", "assistant", "root"), "root");
	const requests: {
		parent: string | null;
		ancestor: string | null;
		aborted: boolean;
	}[] = [];
	const transport: ChatTransport<ChatMessage> = {
		reconnectToStream: () => Promise.resolve(null),
		sendMessages: (options) =>
			Promise.resolve(
				new ReadableStream<UIMessageChunk>({
					start(controller) {
						const parent = options.messages.at(-1)?.id ?? null;
						const index = requests.length;
						const record = {
							parent,
							ancestor: parent ? (thread.getParent(parent)?.id ?? null) : null,
							aborted: false,
						};
						requests.push(record);
						const timer = setTimeout(() => {
							controller.enqueue({
								type: "start",
								messageId: `answer-${index}`,
								messageMetadata: message(`answer-${index}`, "assistant", parent)
									.metadata,
							});
							controller.enqueue({ type: "text-start", id: "text" });
							controller.enqueue({
								type: "text-delta",
								id: "text",
								delta: `controlled answer ${index}`,
							});
							controller.enqueue({ type: "text-end", id: "text" });
							controller.close();
						}, 700);
						options.abortSignal?.addEventListener(
							"abort",
							() => {
								record.aborted = true;
								clearTimeout(timer);
								controller.enqueue({ type: "abort" });
								controller.close();
							},
							{ once: true },
						);
					},
				}),
			),
	};
	thread.transport = transport;
	return { store, thread, requests };
}
function Controls() {
	const view = useConversationView();
	const { openArtifact } = useArtifact();
	const input = useChatInput();
	useSyncExternalStore(
		view.store.subscribe,
		view.store.getState,
		view.store.getInitialState,
	);
	return (
		<div>
			<button type="button" onClick={() => view.select("branch-a")}>
				Select A
			</button>
			<button type="button" onClick={() => view.select("branch-b")}>
				Select B
			</button>
			<button
				type="button"
				onClick={() =>
					openArtifact({
						documentId: "init",
						messageId: view.store.getState().cursorId ?? "root",
						title: "Origin document",
						content: "Origin content",
						kind: "text",
						status: "idle",
						isVisible: true,
					})
				}
			>
				Open origin document
			</button>
			<button
				type="button"
				onClick={() => input.handleModelChange("openai/gpt-4o-mini")}
			>
				Choose alternate model
			</button>
			<output data-testid="scope-state">
				{JSON.stringify({
					cursor: view.store.getState().cursorId,
					model: input.selectedModelId,
					attachments: input.attachments.length,
				})}
			</output>
		</div>
	);
}
function Pane() {
	const view = useConversationView();
	const status = useChatStatus();
	return (
		<>
			<Controls />
			<MessagesPane
				chatId={view.thread.id}
				isReadonly={false}
				status={status}
			/>
		</>
	);
}
export default function ProofPage() {
	const [runtime] = useState(fixture);
	const [showLeft, setShowLeft] = useState(true);
	useSyncExternalStore(
		runtime.thread.subscribe,
		runtime.thread.getSnapshot,
		runtime.thread.getSnapshot,
	);
	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<button type="button" onClick={() => setShowLeft((value) => !value)}>
				Toggle left
			</button>
			<output data-testid="requests">{JSON.stringify(runtime.requests)}</output>
			<CustomStoreProvider store={runtime.store} thread={runtime.thread}>
				<div style={{ display: "flex", flex: 1, minHeight: 0 }}>
					{showLeft && (
						<section
							data-view="left"
							style={{
								width: "50%",
								display: "flex",
								flexDirection: "column",
								minHeight: 0,
							}}
						>
							<ConversationView id="left" initialCursorId="branch-a">
								<ChatInputProvider storageKey="p1-left" localStorageEnabled>
									<Pane />
								</ChatInputProvider>
							</ConversationView>
						</section>
					)}
					<section
						data-view="right"
						style={{
							width: "50%",
							display: "flex",
							flexDirection: "column",
							minHeight: 0,
						}}
					>
						<ConversationView id="right" initialCursorId="branch-b">
							<ChatInputProvider storageKey="p1-right" localStorageEnabled>
								<Pane />
							</ChatInputProvider>
						</ConversationView>
					</section>
				</div>
			</CustomStoreProvider>
		</div>
	);
}
