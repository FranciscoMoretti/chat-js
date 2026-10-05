import { describe, expect, test } from "vitest";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveRuntimeEnvOptions } from "./env-schema";
/* oxlint-enable sort-imports */

const schema = z.object(getEveRuntimeEnvOptions({}));
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): valid uses 32 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const valid = {
  EVE_GATEWAY_SECRET: "a".repeat(32),
  EVE_INTERNAL_ORIGIN: "http://localhost:3000",
  WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve",
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): describe("EVE runtime environment") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): describe("EVE runtime environment") accepts value; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
describe("EVE runtime environment", () => {
  test("requires the complete runtime contract", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  test.each([
    "https://example.com",
    "https://worker.internal:8443",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.2.3.4:3000",
    "http://[::1]:3000",
    "http://[0:0:0:0:0:0:0:1]:3000",
  ])("allows a secure or loopback origin: %s", (EVE_INTERNAL_ORIGIN) => {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    expect(schema.safeParse({ ...valid, EVE_INTERNAL_ORIGIN }).success).toBe(
      true
    );
  });

  test.each([
    "http://example.com",
    "http://worker.internal:8080",
    "http://10.0.0.1",
    "http://0.0.0.0:3000",
    "http://[::]:3000",
    "http://[2001:db8::1]",
    "http://localhost.example.com",
    "http://127.0.0.1.example.com",
    "http://localhost@example.com",
    "http://user:password@localhost:3000",
    "https://example.com?token=1",
    "https://example.com#fragment",
    "https://user:password@example.com",
  ])("rejects an unsafe or non-origin URL: %s", (EVE_INTERNAL_ORIGIN) => {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    expect(schema.safeParse({ ...valid, EVE_INTERNAL_ORIGIN }).success).toBe(
      false
    );
  });

  test.each([
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, EVE_GATEWAY_SECRET: "short" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, EVE_INTERNAL_ORIGIN: "not-a-url" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, EVE_INTERNAL_ORIGIN: "https://example.com/api/eve" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, WORKFLOW_POSTGRES_URL: "not-a-url" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, EVE_INTERNAL_ORIGIN: "postgresql://localhost/eve" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing valid own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...valid, WORKFLOW_POSTGRES_URL: "https://localhost/eve" },
  ])("rejects malformed runtime configuration", (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
/* oxlint-enable max-lines-per-function, typescript/prefer-readonly-parameter-types */

test.each(["preview", "production"])(
  "Vercel %s needs no workflow database",
  (VERCEL_ENV) => {
    const managed = z.object(
      getEveRuntimeEnvOptions({ VERCEL: "1", VERCEL_ENV })
    );
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding credentials excludes WORKFLOW_POSTGRES_URL from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    const { WORKFLOW_POSTGRES_URL: _unused, ...credentials } = valid;
    expect(managed.safeParse(credentials).success).toBe(true);
    expect(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      managed.safeParse({ ...credentials, WORKFLOW_POSTGRES_URL: "" }).success
    ).toBe(true);
    expect(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      managed.safeParse({ ...credentials, EVE_GATEWAY_SECRET: "short" }).success
    ).toBe(false);
    expect(schema.safeParse(credentials).success).toBe(false);
  }
);
