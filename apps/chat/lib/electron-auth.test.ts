/* oxlint-disable eslint/no-magic-numbers, eslint/max-statements, eslint/max-lines-per-function, unicorn/no-await-expression-member -- This ordered auth integration scenario checks HTTP statuses, PKCE, state, session cookies and one-time token consumption together. */
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the server PKCE contract using SHA-256.
import { createHash } from "node:crypto";

import { betterAuth } from "better-auth";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";

import authClient from "./auth-client";
import {
  buildSocialAuthRequest,
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_TRUSTED_ORIGINS,
} from "./electron-auth";
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
  expect((await exchange(`${ELECTRON_APP_SCHEME}://`)).status).toBe(403);
  expect(
    (await exchange(`${ELECTRON_APP_SCHEME}:/`, "wrong-verifier")).status
  ).toBe(400);
  expect(
    (await exchange(`${ELECTRON_APP_SCHEME}:/`, codeVerifier, "wrong-state"))
      .status
  ).toBe(400);
  const session = await exchange(`${ELECTRON_APP_SCHEME}:/`);
  expect(session.status).toBe(200);
  expect(session.headers.get("set-cookie")).toContain("session_token=");
  expect(await session.json()).toMatchObject({
    user: { email: "desktop@example.test" },
  });
  expect((await exchange(`${ELECTRON_APP_SCHEME}:/`)).status).toBe(404);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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
