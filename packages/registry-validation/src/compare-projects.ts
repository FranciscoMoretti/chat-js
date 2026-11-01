import { isDeepStrictEqual } from "node:util";
import type { ProjectFiles } from "./project-files";

export interface ParityDifference {
  readonly file: string;
  readonly kind: "missing" | "unexpected" | "changed";
  readonly offset?: number;
}

/** Exact inventory and byte comparison unless the caller explicitly normalizes. */
export const compareProjects = async (
  expected: ProjectFiles,
  actual: ProjectFiles,
  options: Readonly<{
    include?: (file: string) => boolean;
    normalize?: (file: string, content: Uint8Array) => unknown;
  }> = {}
): Promise<ParityDifference[]> => {
  const names = [...new Set([...expected.keys(), ...actual.keys()])]
    .filter((file) => options.include?.(file) ?? true)
    .toSorted();
  const results = await Promise.allSettled(
    names.map(async (file): Promise<ParityDifference | undefined> => {
      const left = expected.get(file);
      const right = actual.get(file);
      if (!left) {
        return { file, kind: "unexpected" };
      }
      if (!right) {
        return { file, kind: "missing" };
      }
      const [a, b] = await Promise.all([
        Promise.resolve(
          options.normalize ? options.normalize(file, left) : left
        ),
        Promise.resolve(
          options.normalize ? options.normalize(file, right) : right
        ),
      ]);
      if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
        return isDeepStrictEqual(a, b) ? undefined : { file, kind: "changed" };
      }
      const length = Math.max(a.length, b.length);
      for (let offset = 0; offset < length; offset += 1) {
        if (a[offset] !== b[offset]) {
          return { file, kind: "changed", offset };
        }
      }
      return undefined;
    })
  );
  const differences: ParityDifference[] = [];
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
    if (result.value) {
      differences.push(result.value);
    }
  }
  return differences;
};
