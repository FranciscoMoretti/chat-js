import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transformUiSource } from "../../../registry/ui-source";
import { parseJsonObject, requireJsonObject } from "./json-object";
import { directoryFiles } from "#cli/utils/installation-files";
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
  if (base === "base") {
    return;
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
  registries["@chatjs"] = address.replace(
    /\/(?:base\/|radix\/)?\{name\}\.json/u,
    "/radix/{name}.json"
  );
  const groups = await Promise.all(
    ["app", "components", "hooks", "providers", "lib"].map(
      async (directory) => await directoryFiles(cwd, directory)
    )
  );
  const files = groups.flat();
  await Promise.all(
    files
      .filter(
        (file) => file.endsWith(".tsx") && !file.startsWith("components/ui/")
      )
      .map(async (file) => {
        const destination = path.join(cwd, file);
        const source = await readFile(destination, "utf-8");
        const transformed = transformUiSource(source, file, base);
        if (transformed !== source) {
          await writeFile(destination, transformed);
        }
      })
  );
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
};
