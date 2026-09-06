import { useState } from "react";
import type { z } from "zod";
import type { revision, textResult } from "./contract";

export function TextEditor({
	value,
	save,
	onCommit,
}: {
	value: z.infer<typeof revision>;
	save: (content: string) => Promise<z.infer<typeof textResult>>;
	onCommit: (result: z.infer<typeof textResult>) => void;
}) {
	const [draft, setDraft] = useState(value.content);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	return (
		<section aria-label="Text editor">
			<label>
				Content
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			</label>
			<button
				type="button"
				disabled={saving}
				onClick={async () => {
					setSaving(true);
					setError("");
					try {
						onCommit(await save(draft));
					} catch {
						setError(
							"Save failed. Your draft is preserved; reload to compare revisions.",
						);
					} finally {
						setSaving(false);
					}
				}}
			>
				Save
			</button>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}
