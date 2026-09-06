import type { ConfirmedNote } from "../../lib/note-contract";
export default function Note({ output }: { output: ConfirmedNote }) {
	return <p className="note">Confirmed: {output.note}</p>;
}
