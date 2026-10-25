import { archiveManifest } from "./archive-manifest";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { semver } from "bun";
import { z } from "zod";
import ts from "typescript";

const dependencyMap = z.record(z.string(), z.string());
const packageSchema = z.looseObject({
  name: z.string(),
  version: z.string(),
  dependencies: dependencyMap.optional(),
  devDependencies: dependencyMap.optional(),
  peerDependencies: dependencyMap.optional(),
  optionalDependencies: dependencyMap.optional(),
});

interface MountedPackage {
  readonly directory: string;
  readonly manifest: z.infer<typeof packageSchema>;
  readonly virtual: string;
  readonly names: Set<string>;
}

const dependencyRoot = "/registry-dependencies";
const applicationRoot = "/registry-project";

const fixtureBoundary = (directory: string): string => {
  let parent = directory;
  while (parent !== path.dirname(parent)) {
    const file = path.join(parent, "package.json");
    if (existsSync(file)) {
      const manifest = z
        .object({ workspaces: z.unknown().optional() })
        .parse(JSON.parse(readFileSync(file, "utf-8")));
      if (manifest.workspaces !== undefined) {
        return parent;
      }
    }
    parent = path.dirname(parent);
  }
  return directory;
};

const findPackage = (
  name: string,
  from: string,
  boundary: string
): string | undefined => {
  const require = createRequire(path.join(from, "package.json"));
  for (const location of require.resolve.paths(name) ?? []) {
    const candidate = path.join(location, name);
    if (
      candidate.startsWith(`${boundary}${path.sep}`) &&
      existsSync(path.join(candidate, "package.json"))
    ) {
      const real = realpathSync(candidate);
      return real.startsWith(`${boundary}${path.sep}`) ? real : undefined;
    }
  }
  return undefined;
};

// Canonical package roots live outside the application's ancestors. Resolving a
// declaration cannot accidentally inherit undeclared packages from the repo.
class DependencyFiles {
  private readonly packages = new Map<string, MountedPackage>();
  private readonly physical = new Map<string, MountedPackage>();
  private readonly aliases = new Map<string, string>();
  private readonly rootDependencies: Record<string, string>;
  readonly versions = new Map<string, string>();

  private readonly fixtureDirectory: string;
  private readonly boundary: string;

  constructor(
    manifestSource: string,
    fixtureDirectory: string,
    files: ReadonlyMap<string, Uint8Array>
  ) {
    this.fixtureDirectory = realpathSync(fixtureDirectory);
    this.boundary = fixtureBoundary(this.fixtureDirectory);
    const manifest = packageSchema.parse(JSON.parse(manifestSource));
    this.rootDependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };
    for (const [name, range] of Object.entries(this.rootDependencies)) {
      if (!range.startsWith("file:")) {
        continue;
      }
      const file = files.get(range.slice("file:".length).replace(/^\.\//u, ""));
      if (!file) {
        throw new Error(`Missing declared package archive: ${range}`);
      }
      const packed = packageSchema.parse(archiveManifest(file));
      this.rootDependencies[name] = `npm:${packed.name}@${packed.version}`;
    }
  }

  private mount(
    name: string,
    range: string,
    from: string,
    checkVersion = true
  ): MountedPackage | undefined {
    const alias = range.startsWith("npm:")
      ? range.slice("npm:".length)
      : undefined;
    const aliasSeparator = alias?.lastIndexOf("@") ?? -1;
    const expectedName =
      alias !== undefined && aliasSeparator > 0
        ? alias.slice(0, aliasSeparator)
        : name;
    const expectedRange =
      alias !== undefined && aliasSeparator > 0
        ? alias.slice(aliasSeparator + 1)
        : range;
    const directory = findPackage(name, from, this.boundary);
    if (directory === undefined) {
      return undefined;
    }
    const previous = this.physical.get(directory);
    const manifest =
      previous?.manifest ??
      packageSchema.parse(
        JSON.parse(readFileSync(path.join(directory, "package.json"), "utf-8"))
      );
    if (manifest.name !== expectedName) {
      throw new Error(
        `Dependency fixture resolved ${name} to ${manifest.name}, expected ${expectedName}`
      );
    }
    // Check selected direct pins. Transitive declarations use the fixture's
    // actual installed versions, as tsc does (including optional peer ranges
    // that package managers may not enforce). Root archives supply their packed
    // identity/version; artifact contents remain covered by real-install parity.
    if (
      checkVersion &&
      !expectedRange.startsWith("file:") &&
      !expectedRange.startsWith("workspace:") &&
      !/^https?:/u.test(expectedRange) &&
      !semver.satisfies(manifest.version, expectedRange)
    ) {
      throw new Error(
        `Dependency fixture has ${name}@${manifest.version}, expected ${range}`
      );
    }
    if (previous) {
      previous.names.add(name);
      return previous;
    }
    const mounted = {
      directory,
      manifest,
      virtual: `${dependencyRoot}/${this.packages.size}`,
      names: new Set([name, manifest.name]),
    };
    this.packages.set(mounted.virtual, mounted);
    this.physical.set(directory, mounted);
    this.versions.set(`${name}:${mounted.virtual}`, manifest.version);
    return mounted;
  }

  private owner(file: string): MountedPackage | undefined {
    const prefix = file.split("/").slice(0, 3).join("/");
    return this.packages.get(prefix);
  }

  private dependencies(owner?: MountedPackage): Record<string, string> {
    if (!owner) {
      return this.rootDependencies;
    }
    return {
      // Installed declarations can refer to the consumer's declared peers
      // (including ambient @types). This never exposes the fixture's manifest.
      ...this.rootDependencies,
      ...owner.manifest.peerDependencies,
      ...owner.manifest.dependencies,
      ...owner.manifest.optionalDependencies,
    };
  }

  private resolveAlias(file: string): string | undefined {
    const marker = "/node_modules/";
    const index = file.indexOf(marker);
    if (index === -1) {
      return file;
    }
    const base = file.slice(0, index);
    const owner = this.packages.get(base);
    if (base !== applicationRoot && !owner) {
      const containingPackage = this.owner(base);
      // Some packages ship bundled declarations beneath dist/node_modules.
      // Those are package contents, unlike an installed root node_modules.
      if (
        containingPackage &&
        base.startsWith(`${containingPackage.virtual}/`)
      ) {
        return file;
      }
      return undefined;
    }
    const suffix = file.slice(index + marker.length);
    const parts = suffix.split("/");
    const name = parts.slice(0, suffix.startsWith("@") ? 2 : 1).join("/");
    if (owner?.names.has(name) === true) {
      return this.resolveAlias(`${owner.virtual}${suffix.slice(name.length)}`);
    }
    const declared = this.dependencies(owner)[name];
    if (declared === undefined) {
      return undefined;
    }
    const key = `${base}${marker}${name}`;
    let target = this.aliases.get(key);
    if (target === undefined) {
      const mounted = this.mount(
        name,
        declared,
        owner?.directory ?? this.fixtureDirectory,
        owner === undefined
      );
      if (!mounted) {
        return undefined;
      }
      target = mounted.virtual;
      this.aliases.set(key, target);
    }
    return this.resolveAlias(`${target}${suffix.slice(name.length)}`);
  }

  realpath(file: string): string {
    return this.resolveAlias(file) ?? file;
  }

  private diskPath(file: string): string | undefined {
    const canonical = this.resolveAlias(file);
    if (canonical === undefined) {
      return undefined;
    }
    const owner = this.owner(canonical);
    if (!owner) {
      return undefined;
    }
    const suffix = canonical.slice(owner.virtual.length);
    const physical = path.resolve(owner.directory, `.${suffix}`);
    if (
      physical !== owner.directory &&
      !physical.startsWith(`${owner.directory}${path.sep}`)
    ) {
      return undefined;
    }
    // Do not follow package-owned links out to arbitrary checkout files.
    if (existsSync(physical)) {
      const real = realpathSync(physical);
      if (
        real !== owner.directory &&
        !real.startsWith(`${owner.directory}${path.sep}`)
      ) {
        return undefined;
      }
    }
    return physical;
  }

  readFile(file: string): string | undefined {
    const disk = this.diskPath(file);
    return disk !== undefined && existsSync(disk) && statSync(disk).isFile()
      ? readFileSync(disk, "utf-8")
      : undefined;
  }

  fileExists(file: string): boolean {
    const disk = this.diskPath(file);
    return disk !== undefined && existsSync(disk) && statSync(disk).isFile();
  }

  directoryExists(directory: string): boolean {
    if (
      directory.endsWith("/node_modules") ||
      directory.includes("/node_modules/@")
    ) {
      const [base] = directory.split("/node_modules");
      if (base === applicationRoot || this.packages.has(base)) {
        const scope = directory.slice(base.length + "/node_modules/".length);
        if (
          directory.endsWith("/node_modules") ||
          (scope.startsWith("@") && !scope.includes("/"))
        ) {
          return true;
        }
      }
    }
    const disk = this.diskPath(directory);
    return (
      disk !== undefined && existsSync(disk) && statSync(disk).isDirectory()
    );
  }

  getDirectories(directory: string): string[] {
    const [base] = directory.split("/node_modules");
    if (
      directory === `${base}/node_modules/@types` &&
      (base === applicationRoot || this.packages.has(base))
    ) {
      return Object.keys(this.dependencies(this.packages.get(base)))
        .filter((name) => name.startsWith("@types/"))
        .map((name) => name.slice("@types/".length));
    }
    const disk = this.diskPath(directory);
    return disk !== undefined && existsSync(disk)
      ? readdirSync(disk, { withFileTypes: true })
          .filter(
            (entry) => entry.isDirectory() && entry.name !== "node_modules"
          )
          .map((entry) => entry.name)
      : [];
  }

  compilerLibrary(): string {
    const compiler = this.mount(
      "typescript",
      this.rootDependencies.typescript ?? "*",
      this.fixtureDirectory
    );
    if (!compiler) {
      throw new Error("The dependency fixture must contain TypeScript.");
    }
    if (compiler.manifest.version !== ts.version) {
      throw new Error(
        `Checker ${ts.version} does not match fixture TypeScript ${compiler.manifest.version}`
      );
    }
    return `${compiler.virtual}/lib/lib.d.ts`;
  }
}

export { DependencyFiles };
