import { afterEach, beforeEach, vi } from "vitest";

const envMock = vi.hoisted(
  (): {
    VERCEL_PROJECT_ID: string | undefined;
    VERCEL_TEAM_ID: string | undefined;
    VERCEL_TOKEN: string | undefined;
  } => ({
    VERCEL_PROJECT_ID: undefined,
    VERCEL_TEAM_ID: undefined,
    VERCEL_TOKEN: undefined,
  })
);

vi.mock("@/lib/env", () => ({ env: envMock }));

const configureSandboxCredentials = (token = "opaque"): void => {
  Object.assign(envMock, {
    VERCEL_PROJECT_ID: "project",
    VERCEL_TEAM_ID: "team",
    VERCEL_TOKEN: token,
  });
};

const setupSandboxTestEnvironment = (): {
  readonly envMock: typeof envMock;
  readonly configureSandboxCredentials: typeof configureSandboxCredentials;
} => {
  beforeEach(() => {
    for (const name of [
      "VERCEL_OIDC_TOKEN",
      "VERCEL_SANDBOX_IMAGE_JAVASCRIPT",
      "VERCEL_SANDBOX_IMAGE_PYTHON",
    ]) {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest requires an explicit undefined value to remove this environment variable.
      vi.stubEnv(name, undefined);
    }
    for (const key of Object.keys(envMock).filter(
      (candidate): candidate is keyof typeof envMock =>
        Object.hasOwn(envMock, candidate)
    )) {
      envMock[key] = undefined;
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  return { configureSandboxCredentials, envMock };
};

export { setupSandboxTestEnvironment };
