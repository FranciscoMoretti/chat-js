import { requireCredentials } from "@/lib/required-credentials";

// Read at registration time so an omitted integration never validates credentials.
export const getLangfuseEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
) => {
  requireCredentials(
    "langfuse",
    [{ options: [["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]] }],
    environment
  );
  return {
    baseUrl: environment.LANGFUSE_BASE_URL || undefined,
    debug: environment.LANGFUSE_DEBUG === "true",
    publicKey: environment.LANGFUSE_PUBLIC_KEY,
    secretKey: environment.LANGFUSE_SECRET_KEY,
  };
};
