"use client";
import type { InputRequest } from "eve/client";
import { useEveAgent } from "eve/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { components } from "../chat.client";
import { ToolResults } from "../components/chat/tool-results";
import { applicationClient, type Binding } from "../lib/application-client";
import { type ProjectData, projectReducer } from "../lib/projection";
import { sendTurn } from "../lib/send-turn";

const api = applicationClient();
export function Chat() {
	const [binding, setBinding] = useState<Binding>();
	const [resolving, setResolving] = useState(true);

	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);
	useEffect(() => {
		const id = new URL(window.location.href).searchParams.get("conversation");
		if (id)
			void api.conversation.resolve
				.query({ conversationId: id })
				.then(setBinding)
				.catch((cause: Error) => setError(cause.message))
				.finally(() => setResolving(false));
		else setResolving(false);
	}, []);
	async function firstSend() {
		setCreating(true);
		setError("");
		try {
			// Preserve the same operation and payload after a lost response/reload.
			const stored = sessionStorage.getItem("chatjs.pending-create");
			const operation = stored
				? z
						.object({ operationId: z.uuid(), message: z.string() })
						.parse(JSON.parse(stored))
				: { operationId: crypto.randomUUID(), message: draft };
			sessionStorage.setItem(
				"chatjs.pending-create",
				JSON.stringify(operation),
			);
			const next = await api.conversation.create.mutate(operation);
			sessionStorage.removeItem("chatjs.pending-create");
			window.history.replaceState(
				null,
				"",
				`?conversation=${next.conversationId}`,
			);
			setDraft("");
			setBinding(next);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to start conversation",
			);
		} finally {
			setCreating(false);
		}
	}
	return (
		<main>
			{Object.entries(components).map(([key, Component]) => (
				<Component key={key} />
			))}
			<header>
				<h1>Conversation</h1>
				<p>A small space to think things through.</p>
			</header>
			{resolving ? (
				<p>Opening conversation…</p>
			) : binding ? (
				<Conversation key={binding.sessionId} binding={binding} />
			) : (
				<>
					<section className="empty">
						<h2>What would you like to explore?</h2>
						<p>Ask a question.</p>
					</section>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void firstSend();
						}}
					>
						<label htmlFor="first-message">Message</label>
						<textarea
							id="first-message"
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							disabled={creating}
						/>
						<button disabled={creating || !draft.trim()} type="submit">
							{creating ? "Starting…" : "Send"}
						</button>
					</form>
				</>
			)}
			{error && <p role="alert">{error}</p>}
		</main>
	);
}
function Conversation({ binding }: { binding: Binding }) {
	const snapshot = useEveAgent<ProjectData>({
		host: "/api/eve",
		initialSession: { sessionId: binding.sessionId, streamIndex: 0 },
		reducer: projectReducer,
		resume: true,
	});
	const afterCancellation = useRef(0);
	async function send(action: () => Promise<void>) {
		const catchUp = afterCancellation.current;
		await sendTurn(action, snapshot.resume, catchUp > 0);
		if (afterCancellation.current === catchUp) afterCancellation.current = 0;
	}

	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const busy = snapshot.status !== "ready" && snapshot.status !== "error";
	async function run(action: () => Promise<unknown>) {
		setError("");
		try {
			await action();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Request failed");
		}
	}
	return (
		<>
			<output className="status">{snapshot.status}</output>
			<section aria-label="Messages">
				{snapshot.data.messages.map((message) => (
					<article key={message.id} className={message.role}>
						<h2>{message.role === "user" ? "You" : "Assistant"}</h2>
						<p>
							{message.parts
								.filter((part) => part.type === "text")
								.map((part) => part.text)
								.join("\n")}
						</p>
						<ToolResults parts={message.parts} />
					</article>
				))}
			</section>
			{Object.values(snapshot.data.pending).map((input) => (
				<PendingInput
					key={input.requestId}
					input={input}
					disabled={busy}
					respond={(optionId, text) =>
						run(() =>
							send(() =>
								snapshot.respond([
									{
										requestId: input.requestId,
										...(optionId ? { optionId } : {}),
										...(text ? { text } : {}),
									},
								]),
							),
						)
					}
				/>
			))}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					const text = draft;
					setDraft("");
					void run(() => send(() => snapshot.send(text)));
				}}
			>
				<label htmlFor="message">Message</label>
				<textarea
					id="message"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
				<div className="actions">
					<button type="submit" disabled={busy || !draft.trim()}>
						Send
					</button>
					<button
						type="button"
						disabled={!busy}
						onClick={() =>
							void run(async () => {
								const result = await snapshot.cancel();
								if (result.status === "accepted")
									afterCancellation.current += 1;
								return result;
							})
						}
					>
						Stop
					</button>
					<button
						type="button"
						onClick={() =>
							window.location.assign(`?conversation=${binding.conversationId}`)
						}
					>
						Reconnect
					</button>
				</div>
			</form>
			{(error || snapshot.error) && (
				<p role="alert">{error || snapshot.error?.message}</p>
			)}
		</>
	);
}
function PendingInput({
	input,
	disabled,
	respond,
}: {
	input: InputRequest;
	disabled: boolean;
	respond: (optionId?: string, text?: string) => Promise<void>;
}) {
	const [text, setText] = useState("");
	return (
		<section className="pending" aria-label="Pending input">
			<h2>{input.prompt}</h2>
			<div className="actions">
				{input.options?.map((option) => (
					<button
						type="button"
						key={option.id}
						disabled={disabled}
						onClick={() => void respond(option.id)}
					>
						{option.label}
					</button>
				))}
			</div>
			{(input.allowFreeform || !input.options?.length) && (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void respond(undefined, text);
					}}
				>
					<label htmlFor={input.requestId}>Your response</label>
					<input
						id={input.requestId}
						value={text}
						onChange={(event) => setText(event.target.value)}
					/>
					<button disabled={disabled || !text.trim()} type="submit">
						Respond
					</button>
				</form>
			)}
		</section>
	);
}
