import descriptor from "@/features/langfuse/chatjs.json";
import { requireCredentials } from "@/lib/required-credentials";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getLangfuseEnvironment); the enabled import/no-default-export convention rejects the default-export alternative. */
// Read at registration time so an omitted integration never validates credentials.
export const getLangfuseEnvironment = (
  // oxlint-disable-next-line node/no-process-env -- Next's Node instrumentation registration reads process.env only when the optional Langfuse integration is present; injected environments remain supported for callers and tests.
  environment: Readonly<NodeJS.ProcessEnv> = process.env
): {
  baseUrl: string | undefined;
  debug: boolean;
  publicKey: string | undefined;
  secretKey: string | undefined;
} => {
  requireCredentials("langfuse", descriptor.envRequirements, environment);
  const baseUrl = environment.LANGFUSE_BASE_URL;
  const hasBaseUrl = Boolean(baseUrl);
  return {
    // oxlint-disable-next-line eslint/no-undefined, no-ternary -- Preserve the own baseUrl key with undefined for an unset or empty environment value so LangfuseExporter uses its default endpoint.; no-ternary: Keep baseUrl as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    baseUrl: hasBaseUrl ? baseUrl : undefined,
    debug: environment.LANGFUSE_DEBUG === "true",
    publicKey: environment.LANGFUSE_PUBLIC_KEY,
    secretKey: environment.LANGFUSE_SECRET_KEY,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
