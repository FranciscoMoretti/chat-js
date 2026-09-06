import {
	defaultMessageReducer,
	type EveAgentReducer,
	type EveMessageData,
	type InputRequest,
} from "eve/client";
import { type ConfirmedNote, noteOutput } from "./note-contract";

export type ProjectMessage = EveMessageData["messages"][number] & {
	readonly confirmedNotes: readonly ConfirmedNote[];
};
export type ProjectData = {
	readonly messages: readonly ProjectMessage[];
	readonly pending: Readonly<Record<string, InputRequest>>;
};
const base = defaultMessageReducer();
export const projectReducer: EveAgentReducer<ProjectData> = {
	initial: () => ({ messages: [], pending: {} }),
	reduce(data, event) {
		const projected = base.reduce(data, event);
		const messages = projected.messages.map((message) => ({
			...message,
			confirmedNotes: message.parts.flatMap((part) => {
				if (
					part.type !== "dynamic-tool" ||
					part.toolName !== "confirm_note" ||
					part.state !== "output-available"
				)
					return [];
				const result = noteOutput.safeParse(part.output);
				return result.success ? [result.data] : [];
			}),
		}));
		const pending = { ...data.pending };
		if (event.type === "input.requested")
			for (const request of event.data.requests)
				pending[request.requestId] = request;
		if (event.type === "input.resolved")
			for (const resolution of event.data.resolutions)
				delete pending[resolution.requestId];
		return { messages, pending };
	},
};
