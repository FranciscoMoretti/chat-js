/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFileSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { fileURLToPath } from "node:url";
/* oxlint-enable import/no-nodejs-modules */

import { getProvider, PROVIDER_NAMES } from "files-sdk/providers";
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { storageDefinitionSchema } from "../../metadata";
/* oxlint-enable import/no-relative-parent-imports */
import { getStorageEnvironmentRequirements } from "./environment";

/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const sdkPackage = z
  .object({
    peerDependencies: z.record(z.string(), z.string()),
    version: z.string(),
  })
  .parse(
    JSON.parse(
      readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.resolve("files-sdk"))),
          "../package.json"
        ),
        "utf-8"
      )
    )
  );
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable node/no-sync */

const unsupported = new Set(["box", "bun-s3", "convex", "fs"]);
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const builtInStorage = PROVIDER_NAMES.filter(
  (id) => !unsupported.has(id)
).map((id) => {
  const provider = getProvider(id);
  if (!provider) {
    throw new Error(`Missing Files SDK provider: ${id}`);
  }
  return {
    dependencies: [
      `files-sdk@${sdkPackage.version}`,
      ...provider.peerDeps.map((peer) => {
        const version = sdkPackage.peerDependencies[peer];
        if (!version) {
          throw new Error(`Missing Files SDK peer version: ${peer}`);
        }
        return `${peer}@${version}`;
      }),
    ],
    description: provider.description,
    files: [
      {
        path: `src/storage/${id}/storage-provider.ts`,
        target: "~/lib/storage-provider.ts",
        type: "registry:file" as const,
      },
    ],
    meta: {
      chatjs: storageDefinitionSchema.parse({
        configKeys: provider.env.config ?? [],
        contractVersion: 1,
        envRequirements: getStorageEnvironmentRequirements(id).map(
          (requirement) => ({
            description: requirement.description,
            options: requirement.options.map((option) =>
              option.map(({ key }) => key)
            ),
          })
        ),
        id,
        kind: "storage",
        optionalEnv: provider.env.optional?.map(({ key }) => key) ?? [],
      }),
    },
    name: `${id}-storage`,
    title: provider.name,
    type: "registry:item" as const,
  };
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
