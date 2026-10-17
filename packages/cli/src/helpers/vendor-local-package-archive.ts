import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseJsonObject, requireJsonObject } from "./json-object";

const JSON_INDENTATION_SPACES = 2;
const FILE_PREFIX = "file:";

/**
 * Preserve a repository's local candidate bytes in a standalone scaffold.
 * Registry dependencies pass through unchanged when the candidate is released.
 * @param {object} input Template destination, original manifest directory and package name.
 */
export const vendorLocalPackageArchive = async (input: {
  readonly destination: string;
  readonly sourceDir: string;
  readonly packageName: string;
}): Promise<void> => {
  const manifestPath = path.join(input.destination, "package.json");
  const manifest = parseJsonObject(
    await readFile(manifestPath, "utf-8"),
    "Template package.json"
  );
  const dependencies = requireJsonObject(
    manifest.dependencies,
    "Template dependencies"
  );
  const dependency = dependencies[input.packageName];
  if (typeof dependency !== "string" || !dependency.startsWith(FILE_PREFIX)) {
    return;
  }
  if (!dependency.endsWith(".tgz")) {
    throw new Error(`Local ${input.packageName} must be a package archive.`);
  }
  const source = path.resolve(
    input.sourceDir,
    dependency.slice(FILE_PREFIX.length)
  );
  const archiveName = path.basename(source);
  await mkdir(path.join(input.destination, "vendor"), { recursive: true });
  await cp(source, path.join(input.destination, "vendor", archiveName));
  dependencies[input.packageName] = `file:vendor/${archiveName}`;
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, JSON_INDENTATION_SPACES)}\n`
  );
};
