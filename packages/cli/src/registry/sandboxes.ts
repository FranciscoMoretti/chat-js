import { sandboxDefinitionSchema } from "@chat-js/sandboxes/definition";
import { itemAddress, readItem } from "./shadcn";

export const resolveSandbox = async (source: string, cwd = process.cwd()) => {
  const address = itemAddress(source, "sandbox");
  const item = await readItem(address, cwd);
  const definition = sandboxDefinitionSchema.parse(item.meta?.chatjs);
  if (
    item.type !== "registry:item" ||
    !(item.files ?? []).some(
      (file) => file.target === "~/chatjs/providers/sandbox/provider.ts"
    )
  ) {
    throw new Error(
      "Sandbox provider must install chatjs/providers/sandbox/provider.ts exporting createSandboxProvider."
    );
  }
  return { definition, source: address };
};
