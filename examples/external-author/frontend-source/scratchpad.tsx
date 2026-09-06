"use client";

import { useId, useState } from "react";

/** Independent local UI: nothing in this component reads or sends chat data. */
export function Scratchpad() {
	const fieldId = useId();
	const [note, setNote] = useState("");
	return (
		<details style={{ marginBottom: 24 }}>
			<summary>Scratchpad</summary>
			<p id={`${fieldId}-help`}>
				Draft notes here. Notes stay in this component and reset on reload.
			</p>
			<label htmlFor={fieldId}>Scratchpad notes</label>
			<textarea
				id={fieldId}
				aria-describedby={`${fieldId}-help`}
				value={note}
				onChange={(event) => setNote(event.target.value)}
			/>
			<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
				<button
					type="button"
					disabled={note.length === 0}
					onClick={() => setNote("")}
				>
					Clear notes
				</button>
				<span>{note.length} characters</span>
			</div>
		</details>
	);
}
