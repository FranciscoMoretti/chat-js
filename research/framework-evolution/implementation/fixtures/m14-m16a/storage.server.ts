import { Files } from "files-sdk";
import { fs } from "files-sdk/fs";

// Selected native Files SDK factory; external provider source may replace this file.
export function createFiles(root: string) {
	return new Files({ adapter: fs({ root }), retries: 0 });
}
