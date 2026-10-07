/* oxlint-disable eslint/no-magic-numbers, eslint/max-statements, eslint/max-lines-per-function -- This ordered auth integration scenario checks HTTP statuses, PKCE, state, session cookies and one-time token consumption together. */
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the server PKCE contract using SHA-256.
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { betterAuth } from "better-auth";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import authClient from "./auth-client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_TRUSTED_ORIGINS,
  buildSocialAuthRequest,
} from "./electron-auth";
/* oxlint-enable sort-imports */
import { electronAuthPlugin } from "./electron-auth-plugin";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "chatjs", desktopApp: { enabled: true } },
}));

const baseURL = "http://localhost:3999";
const codeVerifier = "test-verifier-with-enough-entropy-for-a-local-fixture";
const query = {
  client_id: ELECTRON_AUTH_CLIENT_ID,
  code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  code_challenge_method: "s256",
  state: "desktop-state",
};

const createTestAuth = (): Pick<ReturnType<typeof betterAuth>, "handler"> =>
  betterAuth({
    advanced: { disableCSRFCheck: false, disableOriginCheck: false },
    baseURL,
    emailAndPassword: { enabled: true },
    plugins: [electronAuthPlugin],
    secret: "test-only-secret-at-least-thirty-two-characters",
    trustedOrigins: [baseURL, ...ELECTRON_TRUSTED_ORIGINS],
  });

it("keeps desktop social callbacks on the session transfer page", () => {
  const request = buildSocialAuthRequest(query, baseURL);
  expect(request.callbackURL).toBe(`${baseURL}/device-login`);
  expect(request.signInOptions).toEqual({
    disableRedirect: true,
    errorCallbackURL: `${baseURL}/device-login`,
    newUserCallbackURL: `${baseURL}/device-login`,
  });
  expect(
    buildSocialAuthRequest({ returnTo: "/chat/current" }, baseURL)
  ).toEqual({
    callbackURL: "/chat/current",
  });
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("transfers a browser login through PKCE and accepts only the current desktop origin", async () => {
  const auth = createTestAuth();
  const login = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: "desktop@example.test",
        name: "Desktop",
        password: "test-password-long-enough",
      }),
      headers: { "content-type": "application/json", origin: baseURL },
      method: "POST",
    })
  );
  expect(login.status).toBe(200);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const transfer = await auth.handler(
    new Request(
      `${baseURL}/api/auth/electron/transfer-user?${new URLSearchParams(query)}`,
      {
        body: "{}",
        headers: {
          "content-type": "application/json",
          cookie,
          origin: baseURL,
        },
        method: "POST",
      }
    )
  );
  expect(transfer.status).toBe(200);
  const { electron_authorization_code: token } = z
    .object({ electron_authorization_code: z.string() })
    .parse(await transfer.json());
  expect(transfer.headers.get("set-cookie")).toContain(
    `${ELECTRON_AUTH_COOKIE_PREFIX}.${ELECTRON_AUTH_CLIENT_ID}=`
  );
  const exchange = async (
    origin: string,
    verifier = codeVerifier,
    state = query.state
  ): Promise<Response> =>
    await auth.handler(
      new Request(`${baseURL}/api/auth/electron/token`, {
        body: JSON.stringify({ code_verifier: verifier, state, token }),
        headers: {
          "content-type": "application/json",
          "electron-origin": origin,
        },
        method: "POST",
      })
    );
  const rejectedOrigin = await exchange(`${ELECTRON_APP_SCHEME}://`);
  expect(rejectedOrigin.status).toBe(403);
  const rejectedVerifier = await exchange(
    `${ELECTRON_APP_SCHEME}:/`,
    "wrong-verifier"
  );
  expect(rejectedVerifier.status).toBe(400);
  const rejectedState = await exchange(
    `${ELECTRON_APP_SCHEME}:/`,
    codeVerifier,
    "wrong-state"
  );
  expect(rejectedState.status).toBe(400);
  const session = await exchange(`${ELECTRON_APP_SCHEME}:/`);
  expect(session.status).toBe(200);
  expect(session.headers.get("set-cookie")).toContain("session_token=");
  expect(await session.json()).toMatchObject({
    user: { email: "desktop@example.test" },
  });
  const consumedTransfer = await exchange(`${ELECTRON_APP_SCHEME}:/`);
  expect(consumedTransfer.status).toBe(404);
});
/* oxlint-enable oxc/no-async-await */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("the inferred browser client delivers the transfer cookie to the current desktop callback", async () => {
  vi.useFakeTimers();
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { replace } });
  vi.stubGlobal("document", {
    cookie: `${ELECTRON_AUTH_COOKIE_PREFIX}.${ELECTRON_AUTH_CLIENT_ID}=transfer-code`,
  });
  authClient.ensureElectronRedirect();
  await vi.advanceTimersByTimeAsync(100);
  expect(replace).toHaveBeenCalledExactlyOnceWith(
    `${ELECTRON_APP_SCHEME}:/${ELECTRON_AUTH_CALLBACK_PATH}#token=transfer-code`
  );
  await vi.advanceTimersByTimeAsync(100);
  expect(replace).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
