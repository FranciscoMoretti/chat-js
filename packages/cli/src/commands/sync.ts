import { Command } from "commander";
import { resolve } from "node:path";
import { syncTools } from "../utils/sync-tools";
import { handleError } from "../utils/handle-error";
export const sync = new Command("sync")
	.description("regenerate typed registrations for installed ChatJS tools")
	.option("-c, --cwd <cwd>", "project directory", process.cwd())
	.action(async (options) => {
		try {
			await syncTools(resolve(options.cwd));
		} catch (error) {
			handleError(error);
		}
	});
