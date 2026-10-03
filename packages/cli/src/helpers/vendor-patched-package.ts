/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { execFile } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import nodePath from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { promisify } from "node:util";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable typescript/strict-void-return -- The receiving framework deliberately ignores this callback result and owns its completion/error handling. */
const exec = promisify(execFile);
/* oxlint-enable typescript/strict-void-return */
const SCOPED_PACKAGE_PREFIX = /^@/u;

const tarballName = (packageName: string, version: string): string =>
  `${packageName.replace(SCOPED_PACKAGE_PREFIX, "").replaceAll("/", "-")}-${version}.tgz`;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/** Ship a checked maintained runtime consistently through Bun, npm, pnpm and Yarn. */
export const vendorPatchedPackage = async (input: {
  destination: string;
  packageDir: string;
  packageName: string;
  patchPath: string;
}): Promise<void> => {
  const manifestPath = nodePath.join(input.destination, "package.json");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  const installed = JSON.parse(
    await readFile(nodePath.join(input.packageDir, "package.json"), "utf-8")
  ) as {
    files?: string[];
    name: string;
    peerDependencies?: Record<string, string>;
    version: string;
  };
  if (
    installed.name !== input.packageName ||
    manifest.dependencies?.[input.packageName] !== installed.version
  ) {
    throw new Error(
      `The template and installed ${input.packageName} versions must match.`
    );
  }
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
    // Reject stale Bun caches rather than silently distributing an unpatched runtime.
    await exec("git", ["apply", "--reverse", "--check", input.patchPath], {
      cwd: staging,
    });
    await writeFile(
      nodePath.join(staging, "package.json"),
      `${JSON.stringify(installed, null, 2)}\n`
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
      { cwd: staging, maxBuffer: 1024 * 1024 * 8 }
    );
    if (!manifest.dependencies) {
      throw new Error("The template package must declare dependencies.");
    }
    manifest.dependencies[input.packageName] = `file:vendor/${archiveName}`;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
