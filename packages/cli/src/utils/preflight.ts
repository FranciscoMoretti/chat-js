import { lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isSafeTarget } from "./is-safe-target";

/** Protect ChatJS-managed outputs before generating integration files. */
export async function preflight(cwd: string, targets: string[]) {
	cwd = resolve(cwd);
	const root = await lstat(cwd);
	if (!root.isDirectory() || root.isSymbolicLink())
		throw new Error("Destination must be a directory, not a symlink.");
	for (const target of targets) {
		if (!isSafeTarget(target, cwd))
			throw new Error(`Unsafe ChatJS target: ${target}`);
		let current = cwd;
		const parts = target.split("/");
		for (const [index, part] of parts.entries()) {
			current = join(current, part);
			const entry = await lstat(current).catch((error) => {
				if (error.code === "ENOENT") return null;
				throw error;
			});
			if (
				entry &&
				(entry.isSymbolicLink() ||
					(index === parts.length - 1 ? !entry.isFile() : !entry.isDirectory()))
			)
				throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
		}
	}
}
