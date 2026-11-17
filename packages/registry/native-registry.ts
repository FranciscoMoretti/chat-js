import type { RegistryItem } from "shadcn/schema";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { auditDependencies } from "@chat-js/registry-validation/ownership";
import { toolDefinitionSchema } from "./metadata";
import { versionedRegistryItem } from "./dependency-contract";

/** A distribution view of the same capability, excluding application contributions. */
export const nativeRegistryItem = (
  item: RegistryItem,
  sources: ReadonlyMap<string, string>
): RegistryItem | undefined => {
  const metadata: unknown = item.meta?.chatjs;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("kind" in metadata) ||
    metadata.kind !== "tool"
  ) {
    return undefined;
  }
  const definition = toolDefinitionSchema.parse(metadata);
  const { native } = definition;
  if (!native) {
    return undefined;
  }
  if (
    (native.layout === "tool" && !native.files.includes("tool.ts")) ||
    new Set(native.files).size !== native.files.length
  ) {
    throw new Error(
      `${item.name}: native files must be unique; the tool layout must include tool.ts.`
    );
  }
  const files = native.files.map((name) => {
    const target =
      native.layout === "agent"
        ? `agent/${name}`
        : `chatjs/tools/${definition.id}/${name}`;
    const file = item.files?.find(
      (candidate) => candidate.target?.replace(/^~\//u, "") === target
    );
    const content = sources.get(target);
    if (!file || content === undefined) {
      throw new Error(`${item.name}: missing declared native source ${name}.`);
    }
    return {
      path: file.path,
      type: "registry:file" as const,
      target:
        native.layout === "agent"
          ? `~/agent/${name}`
          : `~/agent/lib/chatjs/${definition.id}/${name}`,
      content,
    };
  });
  for (const tool of native.layout === "tool" ? definition.tools : []) {
    const name = definition.slot ?? tool.toolExport;
    files.push({
      path: `entrypoints/${definition.id}/${name}.ts`,
      type: "registry:file",
      target: `~/agent/tools/${name}.ts`,
      content: `export { ${tool.toolExport} as default } from "../lib/chatjs/${definition.id}/tool";\n`,
    });
  }
  const result = registryItemSchema.parse(
    versionedRegistryItem({
      name: item.name,
      type: "registry:item",
      title: item.title,
      description: item.description,
      dependencies: native.dependencies,
      files,
    })
  );
  const diagnostics = auditDependencies(
    result,
    new Map(files.map((file) => [file.path, file.content])),
    {
      inheritedPackages: [],
      localImportPrefixes: [],
    }
  );
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics.map((diagnostic) => diagnostic.message).join("\n")
    );
  }
  return result;
};

export const nativeRegistry = (items: RegistryItem[]) =>
  registrySchema.parse({
    name: "chatjs",
    homepage: "https://chatjs.dev",
    items,
  });
