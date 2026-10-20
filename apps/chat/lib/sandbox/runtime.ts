import { createSandboxProvider } from "./provider";

/** Resolve infrastructure independently of whichever tools are installed. */
export const getSandboxProvider = () => {
  if (typeof createSandboxProvider !== "function") {
    throw new TypeError(
      "Select a sandbox provider before using sandbox infrastructure."
    );
  }
  return createSandboxProvider();
};

export const getPersistentSandboxProvider = () => {
  const provider = getSandboxProvider();
  if (!provider.persistent) {
    throw new Error("Persistent sandbox provider is unavailable.");
  }
  return { scope: provider.scope, persistent: provider.persistent };
};
