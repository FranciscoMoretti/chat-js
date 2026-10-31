import { defineSandboxProvider } from "eve/sandbox/provider";
import { supportsPersistentSandbox } from "@/chatjs/providers/sandbox/provider";
import { createPersistentSandboxEnvironment } from "./persistent-sandbox";

const unavailable = async (): Promise<never> =>
  await Promise.reject(
    new Error(
      "The installed sandbox provider does not support persistent files."
    )
  );

// EVE supplies a default cloud/local provider when sandbox.ts is omitted.
// Override it explicitly: ordinary chat can run, filesystem requests must fail.
const disabled = defineSandboxProvider({
  name: "chatjs-sandbox-disabled",
  environment: () => ({
    prepare: async () => await Promise.resolve(null),
    start: unavailable,
    resume: unavailable,
  }),
});

export const createAppSandboxEnvironment = () =>
  supportsPersistentSandbox
    ? createPersistentSandboxEnvironment()
    : disabled.environment();
