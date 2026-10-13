import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

import type * as SocialAuth from "@/lib/social-auth";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams({
      returnTo: "/chat/fixture?view=models#reply",
      label: "a & b",
    }),
}));
vi.mock("@/lib/auth-client", () => ({
  default: {
    getLastUsedLoginMethod: () => null,
    signIn: { social: vi.fn() },
  },
}));
vi.mock("@/lib/social-auth", async (importOriginal) => {
  const original = await importOriginal<typeof SocialAuth>();
  return { ...original, getEnabledSocialAuthProviders: () => ["github"] };
});

test("login and signup links preserve encoded redirect queries", async () => {
  const fixture = await mount(
    <div style={{ display: "flex", gap: 24, padding: 24 }}>
      <section aria-label="Login" style={{ width: 360 }}>
        <LoginForm />
      </section>
      <section aria-label="Signup" style={{ width: 360 }}>
        <SignupForm />
      </section>
    </div>
  );
  try {
    const query =
      "?returnTo=%2Fchat%2Ffixture%3Fview%3Dmodels%23reply&label=a+%26+b";
    await expect
      .element(page.getByRole("link", { name: "Sign up", exact: true }))
      .toHaveAttribute("href", `/register${query}`);
    await expect
      .element(page.getByRole("link", { name: "Sign in", exact: true }))
      .toHaveAttribute("href", `/login${query}`);
    await takeSnapshot("auth-form-route-links");
  } finally {
    await unmount(fixture);
  }
});
