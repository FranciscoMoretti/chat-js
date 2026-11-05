import path from "node:path";
import { z } from "zod";

const packageSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  private: z.boolean().optional(),
  publishConfig: z
    .object({ registry: z.string().optional(), tag: z.string().optional() })
    .optional(),
});
const registryResultSchema = z.object({
  version: z.string(),
  "dist-tags": z.record(z.string(), z.string()),
});
const isPrerelease = (version: string): boolean =>
  version.split("+")[0].includes("-");

export interface ReleasePackage {
  readonly name: string;
  readonly version: string;
  readonly directory: string;
  readonly registry?: string;
  readonly tag?: string;
}

export const publicPrereleases = async (
  root: string
): Promise<ReleasePackage[]> => {
  const manifest: unknown = await Bun.file(
    path.join(root, "package.json")
  ).json();
  const { workspaces } = z
    .object({ workspaces: z.array(z.string()) })
    .parse(manifest);
  const files = workspaces.flatMap((workspace) => [
    ...new Bun.Glob(`${workspace}/package.json`).scanSync(root),
  ]);
  const packages = await Promise.all(
    files.map(async (file): Promise<ReleasePackage[]> => {
      const data: unknown = await Bun.file(path.join(root, file)).json();
      const entry = packageSchema.parse(data);
      if (
        entry.private === true ||
        entry.version === undefined ||
        !isPrerelease(entry.version)
      ) {
        return [];
      }
      return [
        {
          name: entry.name,
          version: entry.version,
          directory: path.dirname(path.join(root, file)),
          registry: entry.publishConfig?.registry,
          tag: entry.publishConfig?.tag,
        },
      ];
    })
  );
  return packages.flat();
};

const queryPublishedPackage = async (
  entry: ReleasePackage
): Promise<unknown> => {
  const command = [
    "npm",
    "view",
    `${entry.name}@${entry.version}`,
    "version",
    "dist-tags",
    "--json",
    "--fetch-timeout=30000",
    "--fetch-retries=1",
  ];
  if (entry.registry !== undefined && entry.registry !== "") {
    command.push("--registry", entry.registry);
  }
  const child = Bun.spawn(command, {
    cwd: entry.directory,
    stdout: "pipe",
    stderr: "ignore",
  });
  const [exitCode, output] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error("npm could not verify the published version");
  }
  return JSON.parse(output);
};

// Changesets defaults to latest even when publishConfig.tag specifies a
// prerelease channel. It may enter the ordinary release path only after every
// local prerelease is already published; Changesets then skips those versions.
// 1.0.0-alpha.1 is the approved default. 1.0.0-alpha.0 fetches registry
// 0.2.0-beta.2 and rejects every gateway because those items still install
// lib/ai/gateway.ts. Pointing latest to another prerelease needs a fresh review.
const approvedPrereleaseDefaults = new Map([["chat-js", "1.0.0-alpha.1"]]);

export const assertPrereleasesPublished = async (
  packages: readonly ReleasePackage[],
  lookup: (entry: ReleasePackage) => Promise<unknown> = queryPublishedPackage
): Promise<void> => {
  await Promise.all(
    packages.map(async (entry) => {
      try {
        const published = registryResultSchema.parse(await lookup(entry));
        const { latest } = published["dist-tags"];
        const approvedDefault =
          latest !== undefined &&
          approvedPrereleaseDefaults.get(entry.name) === latest;
        if (
          published.version !== entry.version ||
          (entry.tag !== undefined &&
            published["dist-tags"][entry.tag] !== entry.version) ||
          (latest !== undefined && isPrerelease(latest) && !approvedDefault)
        ) {
          throw new Error(
            "The exact version and configured tag must match, and latest must be absent, stable, or explicitly approved"
          );
        }
      } catch {
        throw new Error(
          `Refusing ordinary release for ${entry.name}@${entry.version}. Publish the audited prerelease explicitly first with its prerelease tag, verify the exact version and configured tag match and that latest is absent, stable, or explicitly approved, then retry. Registry lookup failures also block publication.`
        );
      }
    })
  );
};

if (import.meta.main) {
  await assertPrereleasesPublished(await publicPrereleases(process.cwd()));
}
