import { createTRPCClient, httpLink } from "@trpc/client";
import { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DocumentRouter } from "./api.server";
import { type RevisionRef, revisionRef, textResult } from "./contract";

import { RevisionButton } from "./result-renderer";

const Editor = lazy(() =>
	import("./text-editor").then((module) => ({ default: module.TextEditor })),
);
const api = createTRPCClient<DocumentRouter>({
	links: [httpLink({ url: `${location.origin}/trpc` })],
});
function TextDocumentResult({ reference }: { reference: RevisionRef }) {
	const [loaded, setLoaded] = useState<Awaited<
		ReturnType<typeof api.getRevision.query>
	> | null>(null);
	const [editing, setEditing] = useState(false);
	const [currentRef, setCurrentRef] = useState(reference);
	const [error, setError] = useState("");
	return (
		<main>
			<h1>Revision contract fixture</h1>
			<output aria-label="Revision">{currentRef.revisionId}</output>
			<RevisionButton
				reference={currentRef}
				onOpen={async (reference) => {
					try {
						setLoaded(await api.getRevision.query(reference));
					} catch {
						setError("Document unavailable");
					}
				}}
			/>
			{error ? <p role="alert">{error}</p> : null}
			{loaded ? (
				<section>
					<h2>{loaded.title}</h2>
					<p>{loaded.content}</p>
					<button type="button" onClick={() => setEditing(true)}>
						Edit
					</button>
					{editing ? (
						<Suspense fallback={<p>Loading editor</p>}>
							<Editor
								key={loaded.revisionId}
								value={loaded}
								save={(content) =>
									api.edit.mutate({
										documentId: loaded.documentId,
										baseRevisionId: loaded.revisionId,
										title: loaded.title,
										content,
									})
								}
								onCommit={(result) => {
									const saved = textResult.parse(result);
									setCurrentRef(saved.ref);
									setEditing(false);
									setLoaded(null);
								}}
							/>
						</Suspense>
					) : null}
				</section>
			) : null}
		</main>
	);
}
const params = new URLSearchParams(location.search);
const ref = revisionRef.parse({
	documentId: params.get("documentId"),
	revisionId: params.get("revisionId"),
});
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
createRoot(root).render(<TextDocumentResult reference={ref} />);
