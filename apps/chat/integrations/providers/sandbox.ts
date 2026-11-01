import { createSandboxProvider as installed } from "@/chatjs/providers/sandbox/provider";

export const createSandboxProvider = () => {
  if (typeof installed !== "function") {
    throw new TypeError(
      "Select a sandbox provider before using sandbox infrastructure."
    );
  }
  return installed();
};
