import { createStore } from "zustand/vanilla";

// Disposable API experiment. No dependency on Next, tRPC, or Eve wire types.
export type Origin = Readonly<{
	conversationId: string;
	viewId: string;
	messageId: string;
	executionId: string;
}>;

export function createView(
	conversationId: string,
	viewId: string,
	cursorId: string,
) {
	return createStore(() => ({
		conversationId,
		viewId,
		cursorId,
		draft: "",
		draftVersion: 0,
		bindingVersion: 0,
	}));
}

export type View = ReturnType<typeof createView>;

export function editDraft(view: View, draft: string) {
	view.setState((state) => ({ draft, draftVersion: state.draftVersion + 1 }));
}

export function draftKey(view: View, principalNamespace: string) {
	const { conversationId, viewId } = view.getState();
	return JSON.stringify([
		"chatjs-draft",
		principalNamespace,
		conversationId,
		viewId,
	]);
}

export function defineServices<
	const Models extends readonly string[],
>(options: {
	models: Models;
	defaultModel: NoInfer<Models[number]>;
	send: (request: {
		conversationId: string;
		viewId: string;
		parentMessageId: string;
		text: string;
		model: Models[number];
	}) => Promise<{ messageId: string; executionId: string }>;
	stop: (origin: Origin) => Promise<void>;
	approve: (
		origin: Origin,
		approvalId: string,
		approved: boolean,
	) => Promise<void>;
}) {
	return options;
}

export function bindComposer<Model extends string>(
	view: View,
	service: {
		defaultModel: Model;
		send: (request: {
			conversationId: string;
			viewId: string;
			parentMessageId: string;
			text: string;
			model: Model;
		}) => Promise<{ messageId: string; executionId: string }>;
	},
) {
	return async (model: Model = service.defaultModel) => {
		const submitted = view.getState();
		const result = await service.send({
			conversationId: submitted.conversationId,
			viewId: submitted.viewId,
			parentMessageId: submitted.cursorId,
			text: submitted.draft,
			model,
		});
		// A late response may not clear newer typing or follow a newly selected path.
		const current = view.getState();
		if (
			current.bindingVersion !== submitted.bindingVersion ||
			current.conversationId !== submitted.conversationId
		)
			return result;
		if (current.cursorId === submitted.cursorId)
			view.setState({ cursorId: result.messageId });
		if (current.draftVersion === submitted.draftVersion)
			view.setState({ draft: "" });
		return result;
	};
}

// Capture the rendered target, never look up a global selected execution on click.
export function bindControls(
	origin: Origin,
	service: {
		stop: (origin: Origin) => Promise<void>;
		approve: (
			origin: Origin,
			approvalId: string,
			approved: boolean,
		) => Promise<void>;
	},
) {
	return {
		stop: () => service.stop(origin),
		approve: (approvalId: string, approved: boolean) =>
			service.approve(origin, approvalId, approved),
	};
}
