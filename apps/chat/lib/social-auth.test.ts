import { describe, expect, it } from "vitest";

import {
  getEnabledSocialAuthProviders,
  isSocialAuthProvider,
  sortSocialAuthProvidersByLastUsed,
} from "./social-auth";

/* oxlint-disable no-undefined, unicorn/no-null --
 * no-undefined (#519): describe("isSocialAuthProvider") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): describe("isSocialAuthProvider") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("isSocialAuthProvider", () => {
  it("accepts configured social auth providers", () => {
    expect(isSocialAuthProvider("google")).toBe(true);
    expect(isSocialAuthProvider("github")).toBe(true);
    expect(isSocialAuthProvider("vercel")).toBe(true);
  });

  it("rejects unknown provider ids", () => {
    expect(isSocialAuthProvider("discord")).toBe(false);
    expect(isSocialAuthProvider(null)).toBe(false);
    expect(isSocialAuthProvider(undefined)).toBe(false);
  });
});
/* oxlint-enable no-undefined, unicorn/no-null */

describe("sortSocialAuthProvidersByLastUsed", () => {
  const providers = [
    { id: "google" as const, label: "Google" },
    { id: "github" as const, label: "GitHub" },
    { id: "vercel" as const, label: "Vercel" },
  ];

  it("moves the remembered provider to the front", () => {
    expect(
      sortSocialAuthProvidersByLastUsed(providers, "github").map(
        ({
          id,
        }: Readonly<
          | { id: "google"; label: string }
          | { id: "github"; label: string }
          | { id: "vercel"; label: string }
        >) => id
      )
    ).toEqual(["github", "google", "vercel"]);
  });

  it("keeps the original order for unknown remembered providers", () => {
    expect(
      sortSocialAuthProvidersByLastUsed(providers, "discord").map(
        ({
          id,
        }: Readonly<
          | { id: "google"; label: string }
          | { id: "github"; label: string }
          | { id: "vercel"; label: string }
        >) => id
      )
    ).toEqual(["google", "github", "vercel"]);
  });
});

describe("getEnabledSocialAuthProviders", () => {
  it("derives enabled providers from authentication config", () => {
    expect(
      getEnabledSocialAuthProviders({
        github: true,
        google: false,
        vercel: true,
      })
    ).toEqual(["github", "vercel"]);
  });

  it("returns providers in product order", () => {
    expect(
      getEnabledSocialAuthProviders({
        github: true,
        google: true,
        vercel: false,
      })
    ).toEqual(["google", "github"]);
  });
});
