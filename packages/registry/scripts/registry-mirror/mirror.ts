import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createInputs } from "./inputs";
import { withMirrorLock } from "./lock";
import { runMirrorLoop } from "./loop";
import { publishFiles } from "./publish";

export interface FileGenerator {
  /** Source-root-relative globs; prefix exclusions with !. */
  readonly inputs: readonly string[];
  /** Return the COMPLETE desired installation without writing into destinationRoot. */
  generate: () => Promise<ReadonlyMap<string, Uint8Array>>;
}
export type MirrorEvent =
  | Readonly<{ type: "success"; settled: boolean }>
  | Readonly<{ type: "failure" | "watch-error"; error: unknown }>;

export const createRegistryMirror = (
  options: Readonly<{
    sourceRoot: string;
    destinationRoot: string;
    manifestPath: string;
    /** Current authorized output paths, evaluated after generation resolves its plan. */
    ownedPaths: () => readonly string[];
    generator: FileGenerator;
  }>
): Readonly<{
  run: (runOptions?: Readonly<{ check?: boolean }>) => Promise<void>;
  watch: (
    watchOptions: Readonly<{
      signal: AbortSignal;
      onEvent: (event: MirrorEvent) => void;
    }>
  ) => Promise<void>;
}> => {
  const reconcile = async (check = false): Promise<void> => {
    await mkdir(path.dirname(options.manifestPath), { recursive: true });
    await withMirrorLock(`${options.manifestPath}.lock`, async () => {
      const files = await options.generator.generate();
      await publishFiles({
        ...options,
        ownedPaths: options.ownedPaths(),
        files,
        check,
      });
    });
  };
  return {
    run: async (runOptions = {}) => {
      await reconcile(runOptions.check);
    },
    watch: async ({ signal, onEvent }) => {
      if (signal.aborted) {
        return;
      }
      await mkdir(path.dirname(options.manifestPath), { recursive: true });
      await withMirrorLock(`${options.manifestPath}.watch.lock`, async () => {
        const inputs = createInputs(
          options.sourceRoot,
          options.generator.inputs
        );
        await runMirrorLoop({
          signal,
          snapshot: inputs.snapshot,
          subscribe: (changed) =>
            inputs.subscribe(changed, (error) => {
              onEvent({ type: "watch-error", error });
            }),
          synchronize: async () => {
            await reconcile();
          },
          succeeded: (settled) => {
            onEvent({ type: "success", settled });
          },
          failed: (error) => {
            onEvent({ type: "failure", error });
          },
        });
      });
    },
  };
};
