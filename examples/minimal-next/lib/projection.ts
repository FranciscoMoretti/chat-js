import {
	defaultMessageReducer,
	type EveAgentReducer,
	type EveMessageData,
	type InputRequest,
} from "eve/client";

export type ProjectMessage = EveMessageData["messages"][number];
export type ProjectData = {
	readonly messages: readonly ProjectMessage[];
	readonly pending: Readonly<Record<string, InputRequest>>;
};
const base = defaultMessageReducer();
export const projectReducer: EveAgentReducer<ProjectData> = {
	initial: () => ({ messages: [], pending: {} }),
	reduce(data, event) {
		const projected = base.reduce(data, event);
		const messages = projected.messages;
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
