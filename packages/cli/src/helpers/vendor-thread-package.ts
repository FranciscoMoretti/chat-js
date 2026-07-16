import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const THREAD_IMPORT_REPLACEMENTS = [
	["@chatjs/thread/react", "@/lib/thread/react"],
	["@chatjs/thread", "@/lib/thread"],
] as const;

async function rewriteThreadImports(directory: string): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true });

	await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				await rewriteThreadImports(path);
				return;
			}
			if (!(entry.isFile() && [".ts", ".tsx"].includes(extname(entry.name)))) {
				return;
			}

			const source = await readFile(path, "utf8");
			let rewritten = source;
			for (const [packageImport, localImport] of THREAD_IMPORT_REPLACEMENTS) {
				rewritten = rewritten.replaceAll(packageImport, localImport);
			}
			if (rewritten !== source) {
				await writeFile(path, rewritten);
			}
		}),
	);
}

export async function vendorThreadPackage(options: {
	destination: string;
	threadSourceDir: string;
}): Promise<void> {
	const localThreadDir = join(options.destination, "lib", "thread");
	await rm(localThreadDir, { recursive: true, force: true });
	await cp(options.threadSourceDir, localThreadDir, { recursive: true });
	await rewriteThreadImports(options.destination);

	const packageJsonPath = join(options.destination, "package.json");
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
		dependencies?: Record<string, string>;
	};
	if (packageJson.dependencies) {
		delete packageJson.dependencies["@chatjs/thread"];
	}
	await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
