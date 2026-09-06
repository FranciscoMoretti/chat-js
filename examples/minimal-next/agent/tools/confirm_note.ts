import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { type ConfirmedNote, noteInput } from "../../lib/note-contract";
export default defineTool({
	description:
		"Confirm a short note after explicit human approval. No external side effects.",
	inputSchema: noteInput,
	approval: {
		request: always(),
		response: ({ responder, session }) =>
			responder.principalId === session.initiator?.principalId
				? { status: "allowed" }
				: { status: "rejected", reason: "Only the owner may respond" },
	},
	async execute({ note }): Promise<ConfirmedNote> {
		return { note, confirmed: true };
	},
});
