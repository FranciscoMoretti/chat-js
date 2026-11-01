import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { SocialAuthProviders } from "@/components/auth-providers";
import type * as SocialAuth from "@/lib/social-auth";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

const signIn = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { url: "https://example.test/authorize" } })
);
vi.mock("@/lib/auth-client", () => ({
  default: {
    getLastUsedLoginMethod: () => "github",
    signIn: { social: signIn },
  },
}));
vi.mock("@/lib/social-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof SocialAuth>()),
  getEnabledSocialAuthProviders: () => ["github", "google", "vercel"],
}));

test("brand buttons preserve icon geometry and GitHub sign-in", async () => {
  const redirect = vi.fn<(url: string) => void>();
  const fixture = await mount(
    <div style={{ padding: 24, width: 360 }}>
      <SocialAuthProviders onRedirectToUrl={redirect} />
    </div>
  );
  try {
    const button = page.getByRole("button", {
      name: "Continue with GitHub Last used",
    });
    await expect.element(button).toBeVisible();
    expect(button.element().querySelectorAll("svg path")).toHaveLength(2);
    await takeSnapshot("social-auth-brand-icons");
    await page.screenshot();
    await button.click();
    await expect
      .poll(() => redirect.mock.calls)
      .toEqual([["https://example.test/authorize"]]);
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" })
    );
  } finally {
    await unmount(fixture);
  }
});
