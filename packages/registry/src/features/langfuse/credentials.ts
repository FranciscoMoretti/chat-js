import descriptor from "@/features/langfuse/chatjs.json";
import { requireCredentials } from "@/lib/required-credentials";

// Read at registration time so an omitted integration never validates credentials.
export const getLangfuseEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
) => {
  requireCredentials("langfuse", descriptor.envRequirements, environment);
  return {
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
    baseUrl: environment.LANGFUSE_BASE_URL || undefined,
    debug: environment.LANGFUSE_DEBUG === "true",
    publicKey: environment.LANGFUSE_PUBLIC_KEY,
    secretKey: environment.LANGFUSE_SECRET_KEY,
  };
};
