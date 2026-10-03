/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { proxy } from "./proxy";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/config", () => ({ config: { desktopApp: { enabled: false } } }));
vi.mock("@/lib/constants", () => ({ isPlaywrightTestEnvironment: false }));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  mocks.session.mockResolvedValue(null);
});
/* oxlint-enable unicorn/no-null */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("lets guest EVE conversations reach page-level ownership checks") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("lets guest EVE conversations reach page-level ownership checks", async () => {
  expect(
    await proxy(new NextRequest("http://localhost/chat/guest-conversation"))
  ).toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, oxc/no-optional-chaining --
 * oxc/no-async-await (#540): it("keeps registered-only pages behind login") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it("keeps registered-only pages behind login") handles optional resolvedResult1?.headers.get("location") without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
it("keeps registered-only pages behind login", async () => {
  for (const path of ["/project/private", "/chat/private/settings"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    const resolvedResult1 = await proxy(
      new NextRequest(`http://localhost${path}`)
    );
    expect(resolvedResult1?.headers.get("location")).toBe(
      "http://localhost/login"
    );
  }
});
/* oxlint-enable oxc/no-async-await, oxc/no-optional-chaining */
