import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { defaultModel, type ModelId } from "./models";

function createView(conversationId: string, id: string) {
	return createStore(() => ({
		conversationId,
		id,
		draft: "",
		model: defaultModel,
	}));
}
const ViewContext = createContext<ReturnType<typeof createView> | null>(null);
export function ConversationView({
	conversationId,
	id,
	children,
}: {
	conversationId: string;
	id: string;
	children: ReactNode;
}) {
	// For this fixture, caller keys the provider when its binding changes.
	const [store] = useState(() => createView(conversationId, id));
	return (
		<ViewContext.Provider value={store}>
			<section data-view={id}>{children}</section>
		</ViewContext.Provider>
	);
}
export function useViewStore() {
	const store = useContext(ViewContext);
	if (!store) throw new Error("Place this component inside ConversationView");
	return store;
}
export function useView<T>(
	selector: (state: ReturnType<ReturnType<typeof createView>["getState"]>) => T,
) {
	return useStore(useViewStore(), selector);
}
export function useSetModel() {
	const store = useViewStore();
	return (model: ModelId) => store.setState({ model });
}
