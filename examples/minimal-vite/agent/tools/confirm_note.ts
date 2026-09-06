import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { confirmEffect } from "../../lib/confirm-effect";
import { type ConfirmedNote, noteInput } from "../../lib/note-contract";
export default defineTool({
	description:
		"Confirm a short note after explicit human approval. Persists the note to the disposable external HTTP receiver.",
	inputSchema: noteInput,
	approval: {
		request: always(),
		response: ({ responder, session }) =>
			responder.principalId === session.initiator?.principalId
				? { status: "allowed" }
				: { status: "rejected", reason: "Only the owner may respond" },
	},
	async execute({ note }, ctx): Promise<ConfirmedNote> {
		return confirmEffect(
			`${ctx.session.id}:${ctx.callId}`,
			note,
			ctx.abortSignal,
		);
	},
});
