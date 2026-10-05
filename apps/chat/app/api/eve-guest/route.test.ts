import { beforeEach, expect, test, vi } from "vitest";

import { readGuestCredential } from "@/lib/eve/disposable-guest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { POST } from "./route";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), model: vi.fn() }));
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
  vi.clearAllMocks();
  settings.VERCEL_URL = "";
  settings.APP_URL = "https://chat.example";
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(() =>
    Response.json({ sessionId: "owned-session" })
  );
});
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const request = (body: unknown, origin = "https://chat.example") =>
  new Request("https://chat.example/api/eve-guest", {
    body: JSON.stringify(body),
    headers: { origin },
    method: "POST",
  });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("creates a native session without application state, returning only its scoped c uses 200, 7 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("creates a native session without application state, returning only its scoped credential", async () => {
  const response = await POST(request({ modelId: "guest-model" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const body = await response.json();
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- #594: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(readGuestCredential(body.credential)).toMatchObject({
    modelId: "guest-model",
    // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- #595: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    sessionId: body.sessionId,
  });
  const [[, init]] = mocks.fetch.mock.calls;
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #594: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #596: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const creation = readGuestCredential(init.headers.authorization.slice(7));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from creation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(creation?.sessionId).toBeUndefined();
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access, oxc/no-optional-chaining -- #594: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. Optional chain: Keep the existing nullish guard when reading ownerId from creation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. Keep the existing nullish guard when reading ownerId from readGuestCredential(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(creation?.ownerId).toBe(readGuestCredential(body.credential)?.ownerId);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("rejects cross-origin and unauthorized model creation before calling EVE") uses 403, 400 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("rejects cross-origin and unauthorized model creation before calling EVE", async () => {
  const crossOrigin = await POST(
    request({ modelId: "guest-model" }, "https://evil.example")
  );
  const premium = await POST(request({ modelId: "premium-model" }));
  const arbitrarySession = await POST(
    request({ modelId: "guest-model", sessionId: "victim" })
  );
  expect(crossOrigin.status).toBe(403);
  expect(premium.status).toBe(400);
  expect(arbitrarySession.status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): test("failed native creation never issues a browser credential") uses 502 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("failed native creation never issues a browser credential") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("failed native creation never issues a browser credential", async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 500 }));
  const response = await POST(request({ modelId: "guest-model" }));
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("credential");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, unicorn/no-null */

test("protected custom-domain bootstrap uses this deployment rather than a separate registered worker", async () => {
  settings.VERCEL_URL = "deployment.vercel.app";
  await POST(request({ modelId: "guest-model" }));
  const [[url, init]] = mocks.fetch.mock.calls;
  expect(String(url)).toBe(
    "https://deployment.vercel.app/eve/guest/v1/session"
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(init.headers["x-vercel-protection-bypass"]).toBe(
    "deployment-bypass-test"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("non-Vercel guest bootstrap stays on the application origin without leaking bypass credentials", async () => {
  await POST(request({ modelId: "guest-model" }));
  const [[url, init]] = mocks.fetch.mock.calls;
  expect(String(url)).toBe("https://chat.example/eve/guest/v1/session");
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(init.headers["x-vercel-protection-bypass"]).toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test("never sends a creation credential to a request-derived host") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("never sends a creation credential to a request-derived host") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("never sends a creation credential to a request-derived host", async () => {
  settings.APP_URL = undefined;
  const response = await POST(
    new Request("https://attacker.example/api/eve-guest", {
      body: JSON.stringify({ modelId: "guest-model" }),
      headers: { origin: "https://attacker.example" },
      method: "POST",
    })
  );
  expect(response.status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, no-undefined */
