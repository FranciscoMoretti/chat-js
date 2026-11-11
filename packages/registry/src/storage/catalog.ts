import { builtInStorageProviders } from "./providers";
import { storageItems } from "./items";
import { readFileSync } from "node:fs";
import { z } from "zod";

const sdkPackage = z
  .object({
    peerDependencies: z.record(z.string(), z.string()),
    version: z.string(),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL("../package.json", import.meta.resolve("files-sdk")),
        "utf-8"
      )
    )
  );

// Dependency version discovery belongs to registry packaging, never the web catalog.
export const builtInStorage = storageItems.map((item) => ({
  ...item,
  dependencies: [
    `files-sdk@${sdkPackage.version}`,
    ...(
      builtInStorageProviders.find(
        (provider) => provider.slug === item.meta.chatjs.id
      )?.peerDeps ?? []
    ).map((peer) => {
      const version = sdkPackage.peerDependencies[peer];
      if (!version) {
        throw new Error(`Missing Files SDK peer version: ${peer}`);
      }
      return `${peer}@${version}`;
    }),
  ],
}));
