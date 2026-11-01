import { installedWorkflowToolNames } from "@/chatjs/generated/installed-tools";
import { toolProviders } from "./providers";
import { installedTools } from "@/chatjs/generated/tools";
import { defineToolSet } from "@/lib/eve/tool-types";

export const tools = defineToolSet({ ...installedTools, ...toolProviders });

// EVE discovers workflow tools in agent/tools; dynamic tools cannot shadow them.
for (const name of installedWorkflowToolNames) {
  if (Object.hasOwn(tools, name)) {
    throw new Error(
      `Dynamic tools conflict with the native workflow tool: ${name}`
    );
  }
}
