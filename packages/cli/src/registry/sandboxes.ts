import { sandboxDefinitionSchema } from "../../../registry/sandbox-definition";
import { itemAddress, readItem } from "./shadcn";

export const resolveSandbox = async (source: string, cwd = process.cwd()) => {
  const address = itemAddress(source, "sandbox");
  const item = await readItem(address, cwd);
  const definition = sandboxDefinitionSchema.parse(item.meta?.chatjs);
  if (
    item.type !== "registry:item" ||
    !(item.files ?? []).some((file) => file.target === "~/agent/sandbox.ts")
  ) {
    throw new Error(
      "Sandbox provider must install a native EVE agent/sandbox.ts."
    );
  }
  return { definition, source: address };
};
