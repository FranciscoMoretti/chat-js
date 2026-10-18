import { beforeEach, expect, test, vi } from "vitest";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { readGuestCredential } from "@/lib/eve/disposable-guest";
import { z } from "zod";

import { POST } from "./route";

const profile = vi.hoisted(() => ({ guestEnabled: true }));
vi.mock("@/eve-runtime.config", () => profile);

const HTTP_STATUS = {
  badGateway: 502,
  badRequest: 400,
  forbidden: 403,
  internalServerError: 500,
  ok: 200,
  serviceUnavailable: 503,
};

// Keep the native HeadersInit tuple-array contract when passing captured headers
// to the Headers constructor; the remaining request fields are deeply readonly.
type ReadonlyFetchInit = Omit<ReadonlyNativeSurface<RequestInit>, "headers"> & {
  readonly headers?: RequestInit["headers"];
};

const mocks = vi.hoisted(() => ({
  fetch:
    vi.fn<
      (
        input: ReadonlyNativeSurface<RequestInfo | URL>,
        init: ReadonlyFetchInit
      ) => Response | Promise<Response>
    >(),
  model: vi.fn(),
}));
const settings = vi.hoisted(
  (): {
    APP_URL: string | undefined;
    EVE_GATEWAY_SECRET: string;
    EVE_INTERNAL_ORIGIN: string;
    VERCEL_AUTOMATION_BYPASS_SECRET: string;
    VERCEL_URL: string;
  } => ({
    APP_URL: "https://chat.example",
    EVE_GATEWAY_SECRET: "test-guest-signing-secret-at-least-32-characters",
    EVE_INTERNAL_ORIGIN: "https://separate-worker.example",
    VERCEL_AUTOMATION_BYPASS_SECRET: "deployment-bypass-test",
    VERCEL_URL: "",
  })
);
vi.mock("@/lib/env", () => ({ env: settings }));
vi.mock("@/lib/db/client", () => {
  throw new Error("Guest creation must not load the database");
});
vi.mock("@/lib/auth", () => {
  throw new Error("Guest creation must not load account authentication");
});
vi.mock("@/lib/eve/model-selection", () => ({
  loadEveModelDefinition: mocks.model,
}));
vi.mock("@/lib/types/anonymous", () => ({
  ANONYMOUS_LIMITS: { AVAILABLE_MODELS: ["guest-model"] },
}));

beforeEach(() => {
  profile.guestEnabled = true;
  vi.clearAllMocks();
  settings.VERCEL_URL = "";
  settings.APP_URL = "https://chat.example";
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(() =>
    Response.json({ sessionId: "owned-session" })
  );
});
const request = (body: unknown, origin = "https://chat.example"): Request =>
  new Request("https://chat.example/api/eve-guest", {
    body: JSON.stringify(body),
    headers: { origin },
    method: "POST",
  });

test("creates a native session without application state, returning only its scoped credential", async () => {
  const response = await POST(request({ modelId: "guest-model" }));
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = z
    .object({ credential: z.string(), sessionId: z.string() })
    .parse(await response.json());
  expect(readGuestCredential(body.credential)).toMatchObject({
    modelId: "guest-model",
    sessionId: body.sessionId,
  });
  const [[, init]] = mocks.fetch.mock.calls;
  const creation = readGuestCredential(
    (new Headers(init.headers).get("authorization") ?? "").slice(
      "Bearer ".length
    )
  );
  expect(creation?.sessionId).toBeUndefined();
  expect(creation?.ownerId).toBe(readGuestCredential(body.credential)?.ownerId);
});

test("rejects cross-origin and unauthorized model creation before calling EVE", async () => {
  const crossOrigin = await POST(
    request({ modelId: "guest-model" }, "https://evil.example")
  );
  const premium = await POST(request({ modelId: "premium-model" }));
  const arbitrarySession = await POST(
    request({ modelId: "guest-model", sessionId: "victim" })
  );
  expect(crossOrigin.status).toBe(HTTP_STATUS.forbidden);
  expect(premium.status).toBe(HTTP_STATUS.badRequest);
  expect(arbitrarySession.status).toBe(HTTP_STATUS.badRequest);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test("failed native creation never issues a browser credential", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(null, { status: HTTP_STATUS.internalServerError })
  );
  const response = await POST(request({ modelId: "guest-model" }));
  expect(response.status).toBe(HTTP_STATUS.badGateway);
  expect(await response.json()).not.toHaveProperty("credential");
});

test("protected custom-domain bootstrap uses this deployment rather than a separate registered worker", async () => {
  settings.VERCEL_URL = "deployment.vercel.app";
  await POST(request({ modelId: "guest-model" }));
  const [[url, init]] = mocks.fetch.mock.calls;
  expect(url).toEqual(
    new URL("https://deployment.vercel.app/eve/guest/v1/session")
  );
  expect(new Headers(init.headers).get("x-vercel-protection-bypass")).toBe(
    "deployment-bypass-test"
  );
});
test("non-Vercel guest bootstrap stays on the application origin without leaking bypass credentials", async () => {
  await POST(request({ modelId: "guest-model" }));
  const [[url, init]] = mocks.fetch.mock.calls;
  expect(url).toEqual(new URL("https://chat.example/eve/guest/v1/session"));
  expect(
    new Headers(init.headers).get("x-vercel-protection-bypass")
  ).toBeNull();
});

test("never sends a creation credential to a request-derived host", async () => {
  settings.APP_URL = undefined;
  const response = await POST(
    new Request("https://attacker.example/api/eve-guest", {
      body: JSON.stringify({ modelId: "guest-model" }),
      headers: { origin: "https://attacker.example" },
      method: "POST",
    })
  );
  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test("disabled guest chat issues no credential and never calls the worker", async () => {
  profile.guestEnabled = false;
  const response = await POST(request({ modelId: "guest-model" }));
  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
  expect(await response.json()).toEqual({
    error: "Guest chat is unavailable on this deployment. Please sign in.",
  });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.model).not.toHaveBeenCalled();
});
