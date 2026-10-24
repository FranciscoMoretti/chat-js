import descriptor from "@/plugins/langfuse/chatjs.json";
import { requireCredentials } from "@/lib/required-credentials";

// Read at registration time so an omitted integration never validates credentials.
export const getLangfuseEnvironment = (
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
    baseUrl: hasBaseUrl ? baseUrl : undefined,
    debug: environment.LANGFUSE_DEBUG === "true",
    publicKey: environment.LANGFUSE_PUBLIC_KEY,
    secretKey: environment.LANGFUSE_SECRET_KEY,
  };
};
