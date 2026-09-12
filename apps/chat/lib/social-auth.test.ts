import { describe, expect, it } from "vitest";

import {
  getEnabledSocialAuthProviders,
  isSocialAuthProvider,
  sortSocialAuthProvidersByLastUsed,
} from "./social-auth";

describe("isSocialAuthProvider", () => {
  it("accepts configured social auth providers", () => {
    expect(isSocialAuthProvider("google")).toBe(true);
    expect(isSocialAuthProvider("github")).toBe(true);
    expect(isSocialAuthProvider("vercel")).toBe(true);
  });

  it("rejects unknown provider ids", () => {
    expect(isSocialAuthProvider("discord")).toBe(false);
    expect(isSocialAuthProvider(null)).toBe(false);
    expect(isSocialAuthProvider()).toBe(false);
  });
});

describe("sortSocialAuthProvidersByLastUsed", () => {
  const providers = [
    { id: "google" as const, label: "Google" },
    { id: "github" as const, label: "GitHub" },
    { id: "vercel" as const, label: "Vercel" },
  ];

  it("moves the remembered provider to the front", () => {
    expect(
      sortSocialAuthProvidersByLastUsed(providers, "github").map(({ id }) => id)
    ).toEqual(["github", "google", "vercel"]);
  });

  it("keeps the original order for unknown remembered providers", () => {
    expect(
      sortSocialAuthProvidersByLastUsed(providers, "discord").map(
        ({ id }) => id
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

  it("returns providers in config order", () => {
    expect(
      getEnabledSocialAuthProviders({
        github: true,
        google: true,
        vercel: false,
      })
    ).toEqual(["google", "github"]);
  });
});
