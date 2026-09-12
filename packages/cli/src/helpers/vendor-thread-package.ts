import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const THREAD_IMPORT_REPLACEMENTS = [
  ["@chat-js/thread/react", "@/lib/thread/react"],
  ["@chat-js/thread", "@/lib/thread"],
] as const;

const rewriteThreadImports = async (directory: string): Promise<void> => {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await rewriteThreadImports(entryPath);
        return;
      }
      if (
        !(entry.isFile() && [".ts", ".tsx"].includes(path.extname(entry.name)))
      ) {
        return;
      }

      const source = await readFile(entryPath, "utf-8");
      let rewritten = source;
      for (const [packageImport, localImport] of THREAD_IMPORT_REPLACEMENTS) {
        rewritten = rewritten.replaceAll(packageImport, localImport);
      }
      if (rewritten !== source) {
        await writeFile(entryPath, rewritten);
      }
    })
  );
};

export const vendorThreadPackage = async (options: {
  destination: string;
  threadSourceDir: string;
}): Promise<void> => {
  const localThreadDir = path.join(options.destination, "lib", "thread");
  await rm(localThreadDir, { force: true, recursive: true });
  await cp(options.threadSourceDir, localThreadDir, { recursive: true });
  await rewriteThreadImports(options.destination);

  const packageJsonPath = path.join(options.destination, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  if (packageJson.dependencies) {
    delete packageJson.dependencies["@chat-js/thread"];
  }
  if (packageJson.scripts?.prebuild) {
    packageJson.scripts.prebuild = packageJson.scripts.prebuild.replace(
      "bun --filter @chat-js/thread build && ",
      ""
    );
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};
