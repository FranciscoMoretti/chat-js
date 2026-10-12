const MANIFEST_INDENTATION_SPACES = 2;

interface ManifestFile {
  content: string;
  file: string;
}

const writePackageFiles = async (
  files: readonly ManifestFile[],
  writeManifest: (file: string, content: string) => Promise<void>
): Promise<void> => {
  const results = await Promise.allSettled(
    files.map(async ({ content, file }: Readonly<ManifestFile>) => {
      await writeManifest(file, content);
    })
  );
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
};

const writeEvePackageManifests = async (
  originals: readonly ManifestFile[],
  archive: string,
  writeManifest: (file: string, content: string) => Promise<void>
): Promise<void> => {
  const prepared = originals.map(
    ({ content, file }: Readonly<ManifestFile>) => {
      const manifest: unknown = JSON.parse(content);
      if (
        typeof manifest !== "object" ||
        manifest === null ||
        !("dependencies" in manifest) ||
        typeof manifest.dependencies !== "object" ||
        manifest.dependencies === null ||
        Array.isArray(manifest.dependencies)
      ) {
        throw new Error(`Expected dependencies in ${file}`);
      }
      Object.assign(manifest.dependencies, { eve: `file:${archive}` });
      return {
        content: `${JSON.stringify(manifest, null, MANIFEST_INDENTATION_SPACES)}\n`,
        file,
      };
    }
  );
  await writePackageFiles(prepared, writeManifest);
};

export { writeEvePackageManifests, writePackageFiles };
