import { createSandboxProvider } from "@/integrations/sandbox";

/** Resolve infrastructure independently of whichever tools are installed. */
export const getSandboxProvider = () => createSandboxProvider();

export const getPersistentSandboxProvider = () => {
  const provider = getSandboxProvider();
  if (!provider.persistent) {
    throw new Error("Persistent sandbox provider is unavailable.");
  }
  return { scope: provider.scope, persistent: provider.persistent };
};
