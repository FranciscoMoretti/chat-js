import { beforeEach, expect, test, vi } from "vitest";

import { resolveEvePrincipal } from "./principal";

const session = vi.hoisted(() => vi.fn());
vi.mock("../auth", () => ({ auth: { api: { getSession: session } } }));
vi.mock("../db/eve-guests", () => {
  throw new Error("Guest resolution must not load the database");
});
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => session.mockResolvedValue(null));
/* oxlint-enable unicorn/no-null */

test("old guest cookies no longer authorize application history", async () => {
  expect(
    await resolveEvePrincipal(
      new Headers({ cookie: "chatjs-eve-guest=old-credential" })
    )
  ).toBeNull();
});

test("registered ownership is unchanged", async () => {
  session.mockResolvedValue({ user: { id: "registered-owner" } });
  expect(await resolveEvePrincipal(new Headers())).toEqual({
    kind: "registered",
    ownerId: "registered-owner",
  });
});
