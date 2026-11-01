import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { preflight } from "./preflight";

/** Publish the same planned files consumed by source-only generation. */
export const writeGeneratedFiles = async (
  cwd: string,
  files: ReadonlyMap<string, string>
): Promise<void> => {
  await preflight(cwd, [...files.keys()]);
  const writes = await Promise.allSettled(
    [...files].map(async ([file, content]) => {
      const target = path.join(cwd, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    })
  );
  for (const result of writes) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
};
