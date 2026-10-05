// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI launches package-manager, Git, or command subprocesses through native process APIs.
import { execFile } from "node:child_process";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import nodePath from "node:path";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI adapts native callback APIs for asynchronous process operations.
import { promisify } from "node:util";

// oxlint-disable-next-line typescript/strict-void-return -- Node documents promisify(execFile): execFile immediately returns ChildProcess, and its native custom promisifier owns the stdout/stderr promise and rejection details rather than consuming that immediate return.
const exec = promisify(execFile);
const SCOPED_PACKAGE_PREFIX = /^@/u;
const JSON_INDENTATION_SPACES = 2;
const PACKING_OUTPUT_LIMIT_BYTES = 8_388_608;

interface VendorInput {
  readonly destination: string;
  readonly packageDir: string;
  readonly packageName: string;
  readonly patchPath: string;
}

interface TemplateManifest {
  dependencies: Record<string, unknown>;
}

interface InstalledManifest {
  name: string;
  version: string;
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTemplateManifest = (value: unknown): value is TemplateManifest =>
  isJsonObject(value) && isJsonObject(value.dependencies);

const isInstalledManifest = (value: unknown): value is InstalledManifest =>
  isJsonObject(value) &&
  typeof value.name === "string" &&
  typeof value.version === "string";

const readVendoringMetadata = async (
  input: VendorInput
): Promise<{ installed: InstalledManifest; manifest: TemplateManifest }> => {
  const manifest: unknown = JSON.parse(
    await readFile(nodePath.join(input.destination, "package.json"), "utf-8")
  );
  const installed: unknown = JSON.parse(
    await readFile(nodePath.join(input.packageDir, "package.json"), "utf-8")
  );
  if (
    !isTemplateManifest(manifest) ||
    !isInstalledManifest(installed) ||
    installed.name !== input.packageName ||
    manifest.dependencies[input.packageName] !== installed.version
  ) {
    throw new Error(
      `The template and installed ${input.packageName} versions must match.`
    );
  }
  // Keep both original JSON objects: publishing fields, dependency metadata and
  // unrelated template fields remain intact when the selected dependency is pinned.
  return { installed, manifest };
};

const formattedManifest = (value: unknown): string =>
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify's null replacer preserves every metadata field while its third argument requests deterministic two-space formatting.
  `${JSON.stringify(value, null, JSON_INDENTATION_SPACES)}\n`;

const tarballName = (packageName: string, version: string): string =>
  `${packageName.replace(SCOPED_PACKAGE_PREFIX, "").replaceAll("/", "-")}-${version}.tgz`;

const packMaintainedArchive = async (
  staging: string,
  input: VendorInput,
  installed: Readonly<InstalledManifest>
): Promise<string> => {
  // Reject stale Bun caches rather than silently distributing an unpatched runtime.
  await exec("git", ["apply", "--reverse", "--check", input.patchPath], {
    cwd: staging,
  });
  await writeFile(
    nodePath.join(staging, "package.json"),
    formattedManifest(installed)
  );
  const vendor = nodePath.join(input.destination, "vendor");
  const archiveName = tarballName(input.packageName, installed.version);
  await mkdir(vendor, { recursive: true });
  await exec(
    "bun",
    [
      "pm",
      "pack",
      "--ignore-scripts",
      "--filename",
      nodePath.join(vendor, archiveName),
      "--quiet",
    ],
    { cwd: staging, maxBuffer: PACKING_OUTPUT_LIMIT_BYTES }
  );
  return archiveName;
};

/**
 * Ship a checked maintained runtime consistently through Bun, npm, pnpm and Yarn.
 * @param {VendorInput} input The installed package, maintained patch and template destination.
 */
export const vendorPatchedPackage = async (
  input: VendorInput
): Promise<void> => {
  const { installed, manifest } = await readVendoringMetadata(input);
  const temporary = await mkdtemp(
    nodePath.join(tmpdir(), "chatjs-patched-package-")
  );
  try {
    const staging = nodePath.join(temporary, "package");
    await cp(input.packageDir, staging, {
      filter: (path): boolean =>
        path !== nodePath.join(input.packageDir, "node_modules"),
      recursive: true,
    });
    const archiveName = await packMaintainedArchive(staging, input, installed);
    manifest.dependencies[input.packageName] = `file:vendor/${archiveName}`;
    await writeFile(
      nodePath.join(input.destination, "package.json"),
      formattedManifest(manifest)
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
};
