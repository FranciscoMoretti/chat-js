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
