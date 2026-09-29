import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { toolDefinitionSchema } from "../../../registry/metadata";
import {
  researchAgentFiles,
  researchAgentDirectories,
} from "../../../registry/src/tools/research";
import { preflight } from "../utils/preflight";
import { validateClonedBundle } from "../utils/validate-cloned-bundle";
import { researchTestFiles } from "./scaffold-content";

export const removeClonedResearch = async (cwd: string): Promise<void> => {
  const bundleDirectory = "tools/chatjs/deep-research";
  const descriptor = `${bundleDirectory}/chatjs.json`;
  if (!existsSync(path.join(cwd, descriptor))) {
    return;
  }
  await preflight(cwd, [
    descriptor,
    ...researchAgentFiles,
    ...researchTestFiles,
  ]);
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(path.join(cwd, descriptor), "utf-8"))
  );
  if (
    definition.id !== "deep-research" ||
    !definition.tools.some(
      (tool) => tool.toolExport === "deepResearch" && tool.workflow
    )
  ) {
    throw new Error(
      "Cannot replace an unrecognized deep-research bundle in the cloned repository."
    );
  }
  await validateClonedBundle(cwd, bundleDirectory, researchAgentDirectories);
  await Promise.all(
    [...researchAgentFiles, ...researchTestFiles].map((file) =>
      rm(path.join(cwd, file), { force: true })
    )
  );
  await Promise.all(
    researchAgentDirectories.map((directory) =>
      rm(path.join(cwd, directory), { force: true, recursive: true })
    )
  );
  await rm(path.join(cwd, bundleDirectory), { recursive: true });
};
