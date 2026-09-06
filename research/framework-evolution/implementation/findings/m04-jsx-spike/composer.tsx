import { useSubmit } from "./queries";
import { useView, useViewStore } from "./view";
export function Composer() {
	const draft = useView((s) => s.draft);
	const store = useViewStore();
	const submit = useSubmit();
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const state = store.getState();
				submit.mutate({
					conversationId: state.conversationId,
					viewId: state.id,
					text: state.draft,
					model: state.model,
				});
			}}
		>
			<label>
				Draft
				<textarea
					value={draft}
					onChange={(event) => store.setState({ draft: event.target.value })}
				/>
			</label>
			<button type="submit" disabled={submit.isPending || !draft.trim()}>
				Send
			</button>
			{submit.isError && <p role="alert">{submit.error.message}</p>}
		</form>
	);
}
