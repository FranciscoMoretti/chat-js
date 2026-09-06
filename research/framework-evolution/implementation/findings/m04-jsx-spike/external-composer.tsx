// Simulates separately supplied source: imports public hooks, never a setup factory.
import { useSubmit } from "./queries";
import { useViewStore } from "./view";
export function ExternalComposer() {
	const store = useViewStore();
	const submit = useSubmit();
	return (
		<>
			<button
				type="button"
				disabled={submit.isPending}
				onClick={() => {
					const state = store.getState();
					submit.mutate({
						conversationId: state.conversationId,
						viewId: state.id,
						text: "external submission",
						model: state.model,
					});
				}}
			>
				External send
			</button>
			{submit.isError && <p role="alert">{submit.error.message}</p>}
		</>
	);
}
