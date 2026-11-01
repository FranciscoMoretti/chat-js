import { afterEach, beforeEach, vi } from "vitest";

const configureSandboxCredentials = (token = "opaque"): void => {
  vi.stubEnv("VERCEL_PROJECT_ID", "project");
  vi.stubEnv("VERCEL_TEAM_ID", "team");
  vi.stubEnv("VERCEL_TOKEN", token);
};

const setupSandboxTestEnvironment = (): {
  readonly configureSandboxCredentials: typeof configureSandboxCredentials;
} => {
  beforeEach(() => {
    for (const name of [
      "VERCEL_PROJECT_ID",
      "VERCEL_TEAM_ID",
      "VERCEL_TOKEN",
      "VERCEL_OIDC_TOKEN",
      "VERCEL_SANDBOX_IMAGE_JAVASCRIPT",
      "VERCEL_SANDBOX_IMAGE_PYTHON",
    ]) {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest requires an explicit undefined value to remove this environment variable.
      vi.stubEnv(name, undefined);
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  return { configureSandboxCredentials };
};

export { setupSandboxTestEnvironment };
