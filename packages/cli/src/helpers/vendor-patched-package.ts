import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const SCOPED_PACKAGE_PREFIX = /^@/u;

const tarballName = (packageName: string, version: string) =>
  `${packageName.replace(SCOPED_PACKAGE_PREFIX, "").replaceAll("/", "-")}-${version}.tgz`;

/** Ship a checked maintained runtime consistently through Bun, npm, pnpm and Yarn. */
export const vendorPatchedPackage = async (input: {
  destination: string;
  packageDir: string;
  packageName: string;
  patchPath: string;
}) => {
  const manifestPath = nodePath.join(input.destination, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as {
    dependencies?: Record<string, string>;
  };
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
      filter: (path) =>
        path !== nodePath.join(input.packageDir, "node_modules"),
      recursive: true,
    });
    // Reject stale Bun caches rather than silently distributing an unpatched runtime.
    await exec("git", ["apply", "--reverse", "--check", input.patchPath], {
      cwd: staging,
    });
    if (input.packageName === "eve") {
      installed.files = [...(installed.files ?? []), "*.js", "*.d.ts"];
      // The maintained sandbox/snapshot integration uses the 0.6 SDK. Correct
      // the archive metadata so npm can enforce its peer contract normally.
      installed.peerDependencies = {
        ...installed.peerDependencies,
        microsandbox: "^0.6.18",
      };
    }
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
