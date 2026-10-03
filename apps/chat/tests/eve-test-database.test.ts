import { afterEach, expect, test, vi } from "vitest";

import { assertEveTestDatabase } from "./eve-test-database";

afterEach(() => vi.unstubAllEnvs());

/* oxlint-disable no-undefined --
 * no-undefined (#519): test("accepts local PostgreSQL without remote credentials or opt-in") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("accepts local PostgreSQL without remote credentials or opt-in", () => {
  vi.stubEnv("EVE_ALLOW_REMOTE_DATABASE_TESTS", undefined);
  vi.stubEnv("EVE_TEST_DATABASE_URL", undefined);
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    expect(() =>
      assertEveTestDatabase(`postgresql://user@${host}:55489/test`)
    ).not.toThrow();
  }
});
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined --
 * no-undefined (#519): test("matching remote credentials alone cannot enable database tests") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("matching remote credentials alone cannot enable database tests", () => {
  const remote = "postgresql://user@isolated.example.test/test";
  vi.stubEnv("EVE_TEST_DATABASE_URL", remote);
  for (const optIn of [undefined, "false", "1", "TRUE"]) {
    vi.stubEnv("EVE_ALLOW_REMOTE_DATABASE_TESTS", optIn);
    expect(() => assertEveTestDatabase(remote)).toThrow("local PostgreSQL");
  }
});
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined --
 * no-undefined (#519): test("remote opt-in still requires the exact isolated database") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("remote opt-in still requires the exact isolated database", () => {
  const remote = "postgresql://user@isolated.example.test/test";
  vi.stubEnv("EVE_ALLOW_REMOTE_DATABASE_TESTS", "true");
  vi.stubEnv("EVE_TEST_DATABASE_URL", undefined);
  expect(() => assertEveTestDatabase(remote)).toThrow();
  vi.stubEnv("EVE_TEST_DATABASE_URL", `${remote}-different`);
  expect(() => assertEveTestDatabase(remote)).toThrow();
  vi.stubEnv("EVE_TEST_DATABASE_URL", remote);
  expect(() => assertEveTestDatabase(remote)).not.toThrow();
});
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined --
 * no-undefined (#519): test("rejects non-PostgreSQL and misleading local URLs") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("rejects non-PostgreSQL and misleading local URLs", () => {
  vi.stubEnv("EVE_ALLOW_REMOTE_DATABASE_TESTS", undefined);
  for (const url of [
    "http://localhost/test",
    "postgresql://localhost.example.test/test",
    "postgresql://localhost@remote.example.test/test",
  ]) {
    expect(() => assertEveTestDatabase(url)).toThrow();
  }
});
/* oxlint-enable no-undefined */
