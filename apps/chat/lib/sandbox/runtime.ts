import { createSandboxProvider } from "@/integrations/providers/sandbox";

/** Resolve infrastructure independently of whichever tools are installed. */
export const getSandboxProvider = () => createSandboxProvider();
