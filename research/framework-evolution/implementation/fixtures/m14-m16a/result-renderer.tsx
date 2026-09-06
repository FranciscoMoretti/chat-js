import type { RevisionRef } from "./contract";

export function RevisionButton({
	reference,
	onOpen,
}: {
	reference: RevisionRef;
	onOpen: (reference: RevisionRef) => void;
}) {
	return (
		<button type="button" onClick={() => onOpen(reference)}>
			Open exact revision
		</button>
	);
}
