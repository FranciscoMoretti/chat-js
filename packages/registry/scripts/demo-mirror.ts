import { runDemoWorker } from "./demo-worker-process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { changedInputs, createInputs } from "./registry-mirror/inputs";
import { demoInputs } from "./demo-inputs";
import { createRegistryMirror } from "./registry-mirror/mirror";

const root = path.resolve(import.meta.dir, "../../..");
const demoRoot = path.join(root, "apps/chat");
const manifestPath = path.join(root, "packages/registry/mirror-manifest.json");
const demoResultSchema = z.object({
  files: z.record(z.string(), z.string()),
  ownedPaths: z.array(z.string()),
});

/** Fresh workers reload the preset and its transitive imports on every generation. */
export const createDemoMirror = (): ReturnType<typeof createRegistryMirror> => {
  let previous: Record<string, string> | undefined;
  let previousInputs: Record<string, string> | undefined;
  const inputs = createInputs(root, demoInputs);
  let ownedPaths: readonly string[] = [];
  return createRegistryMirror({
    sourceRoot: root,
    destinationRoot: demoRoot,
    manifestPath,
    ownedPaths: () => ownedPaths,
    generator: {
      inputs: demoInputs,
      generate: async () => {
        const currentInputs = await inputs.snapshot();
        const changes = previousInputs
          ? changedInputs(previousInputs, currentInputs)
          : undefined;
        const temporary = await mkdtemp(
          path.join(tmpdir(), "chatjs-mirror-worker-")
        );
        try {
          const request = path.join(temporary, "request.json");
          const result = path.join(temporary, "result.json");
          await writeFile(request, JSON.stringify({ changes, previous }));
          await runDemoWorker(
            [path.join(import.meta.dir, "demo-worker.ts"), request, result],
            root
          );
          const generated = demoResultSchema.parse(
            JSON.parse(await readFile(result, "utf-8"))
          );
          previous = generated.files;
          previousInputs = currentInputs;
          ({ ownedPaths } = generated);
          return new Map(
            Object.entries(previous).map(([file, content]) => [
              file,
              new TextEncoder().encode(content),
            ])
          );
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
      },
    },
  });
};
