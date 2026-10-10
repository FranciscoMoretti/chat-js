import { afterEach, beforeEach, vi } from "vitest";

/* oxlint-disable no-undefined -- These explicit absent environment fields must stay undefined; each test can replace the same mutable fixture's string values. */
const envMock = vi.hoisted(
  (): {
    VERCEL_PROJECT_ID: string | undefined;
    VERCEL_SANDBOX_RUNTIME: string | undefined;
    VERCEL_SANDBOX_RUNTIME_PYTHON: string | undefined;
    VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: string | undefined;
    VERCEL_TEAM_ID: string | undefined;
    VERCEL_TOKEN: string | undefined;
  } => ({
    VERCEL_PROJECT_ID: undefined,
    VERCEL_SANDBOX_RUNTIME: undefined,
    VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: undefined,
    VERCEL_SANDBOX_RUNTIME_PYTHON: undefined,
    VERCEL_TEAM_ID: undefined,
    VERCEL_TOKEN: undefined,
  })
);
/* oxlint-enable no-undefined */

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
  /* oxlint-disable no-undefined -- Reset the explicit absent-token state before every test, without replacing the mocked environment object. */
  beforeEach(() => {
    vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
    for (const key of Object.keys(envMock).filter(
      (candidate): candidate is keyof typeof envMock =>
        Object.hasOwn(envMock, candidate)
    )) {
      envMock[key] = undefined;
    }
  });
  /* oxlint-enable no-undefined */
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  return { configureSandboxCredentials, envMock };
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- The app requires named imports; the enabled no-default-export rule rejects a default setup export. */
export { setupSandboxTestEnvironment };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
