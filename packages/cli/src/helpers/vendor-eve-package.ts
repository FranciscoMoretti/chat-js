import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Ship the maintained runtime consistently through Bun, npm, pnpm and Yarn. */
export async function vendorEvePackage(input: {
	destination: string;
	packageDir: string;
	patchPath: string;
}) {
	const manifestPath = join(input.destination, "package.json");
	const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	const installed = JSON.parse(await readFile(join(input.packageDir, "package.json"), "utf8"));
	if (installed.name !== "eve" || manifest.dependencies?.eve !== installed.version) {
		throw new Error("The template and installed eve runtime versions must match.");
	}
	const temporary = await mkdtemp(join(tmpdir(), "chatjs-eve-package-"));
	try {
		const staging = join(temporary, "package");
		await cp(input.packageDir, staging, {
			recursive: true,
			filter: (path) => path !== join(input.packageDir, "node_modules"),
		});
		// Reject stale Bun caches rather than silently distributing an unpatched runtime.
		await exec("git", ["apply", "--reverse", "--check", input.patchPath], { cwd: staging });
		installed.files = [...(installed.files ?? []), "*.js", "*.d.ts"];
		await writeFile(join(staging, "package.json"), `${JSON.stringify(installed, null, 2)}\n`);
		const vendor = join(input.destination, "vendor");
		await mkdir(vendor, { recursive: true });
		await exec("bun", ["pm", "pack", "--ignore-scripts", "--destination", vendor, "--quiet"], {
			cwd: staging,
			maxBuffer: 1024 * 1024 * 8,
		});
		manifest.dependencies.eve = `file:vendor/eve-${installed.version}.tgz`;
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
