import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { confirm, isCancel, text } from "@clack/prompts";
import { installSelection, readSelection } from "./install";
import { minimalSelection, selectionSchema } from "./schema";

export async function createSelected(
	directory: string,
	options: { selection?: string; yes?: boolean; install?: boolean },
) {
	if (options.install === false)
		throw Error(
			"Shared selection creation requires dependency installation and typechecking; omit --no-install.",
		);
	let selection = options.selection
		? await readSelection(options.selection)
		: structuredClone(minimalSelection);
	if (!options.selection && !options.yes) {
		const model = await text({
			message: "Initial model ID",
			initialValue: selection.settings.model,
		});
		if (isCancel(model)) throw Error("Cancelled");
		const note = await confirm({
			message: "Include the example approval tool and lazy result renderer?",
			initialValue: false,
		});
		if (isCancel(note)) throw Error("Cancelled");
		selection = selectionSchema.parse({
			...selection,
			settings: { model },
			items: [...selection.items, ...(note ? ["@chatjs/confirm-note"] : [])],
		});
	}
	const result = await installSelection(selection, directory, "create");
	console.log(
		`Created and typechecked ${resolve(directory)}. Complete ${result.setup} before starting services. Selection saved in chat.selection.json.`,
	);
}

export async function addSelected(
	cwd: string,
	addresses: string[],
	selectionFile?: string,
) {
	const previous = selectionSchema.parse(
		JSON.parse(await readFile(resolve(cwd, "chat.selection.json"), "utf8")),
	);
	const selection = selectionFile
		? await readSelection(selectionFile)
		: selectionSchema.parse({
				...previous,
				items: [...new Set([...previous.items, ...addresses])],
			});
	const result = await installSelection(selection, cwd, "add");
	console.log(
		`Installed selected files/dependencies and typechecked proposed composition while preserving existing source. Proposed composition: ${result.proposals.join(", ") || "none"}. Review .chatjs/proposals and ${result.setup}; adopt intended edits and the proposed selection, then run bun run test:types. Runtime setup is not verified by installation.`,
	);
}
