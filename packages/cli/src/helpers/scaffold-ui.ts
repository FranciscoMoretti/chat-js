import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  selectUiSources,
  uiImplementations,
} from "../../../registry/ui-implementations";
import { parseJsonObject, requireJsonObject } from "./json-object";
import { readUiBase } from "#cli/utils/ui-compatibility";

// Only used on a freshly copied scaffold, after native init resolves the base.
// Native primitives are never transformed; shadcn owns their implementation.
export const prepareScaffoldUi = async (cwd: string): Promise<void> => {
  const base = await readUiBase(cwd);
  if (base !== "base" && base !== "radix") {
    throw new Error(
      "ChatJS requires a native base-* or radix-* style. No selected registry source was installed."
    );
  }
  const configFile = path.join(cwd, "components.json");
  const config = parseJsonObject(
    await readFile(configFile, "utf-8"),
    "components.json"
  );
  const registries = requireJsonObject(
    config.registries,
    "components.json registries"
  );
  const address = registries["@chatjs"];
  if (typeof address !== "string" || !address.includes("/{name}.json")) {
    throw new Error(
      "The fresh ChatJS registry URL must end in /{name}.json to select its Radix variant."
    );
  }
  registries["@chatjs"] =
    base === "base"
      ? address
      : address.replace(
          /\/(?:base\/|radix\/)?\{name\}\.json/u,
          "/radix/{name}.json"
        );
  const core = uiImplementations.filter((entry) =>
    entry.source.startsWith("apps/chat/")
  );
  const variants = core.map((entry) => entry.radix.slice("apps/chat/".length));
  const sources = new Map<string, string>(
    await Promise.all(
      core.map(async (entry) => {
        let content: string;
        try {
          content = await readFile(path.join(cwd, entry.target), "utf-8");
        } catch (error) {
          throw new Error(
            `Missing native Base implementation for ${entry.target}`,
            { cause: error }
          );
        }
        return [entry.target, content] as const;
      })
    )
  );
  const selected = await selectUiSources(
    sources,
    base,
    async (entry) =>
      await readFile(
        path.join(cwd, entry.radix.slice("apps/chat/".length)),
        "utf-8"
      )
  );
  await Promise.all(
    [...selected].map(async ([file, content]) => {
      if (content !== sources.get(file)) {
        await writeFile(path.join(cwd, file), content);
      }
    })
  );
  await Promise.all(
    variants.map(async (file) => {
      await rm(path.join(cwd, file));
    })
  );
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
};
