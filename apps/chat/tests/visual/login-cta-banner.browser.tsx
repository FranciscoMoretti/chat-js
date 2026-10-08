import "./sandbox.css";

import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { mount, unmount } from "./primitive-mount";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
import { MotionConfig } from "motion/react";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

const BANNER_COUNT = 6;

const router = {
  back: vi.fn<() => void>(),
  bfcacheId: "banner-fixture",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  replace: vi.fn<() => void>(),
};
const variants: readonly ("default" | "amber" | "red")[] = [
  "default",
  "amber",
  "red",
];

/* oxlint-disable react/jsx-max-depth -- Native router and Motion providers surround the same banner instances; preserve their context and independent dismissal state. */
/* oxlint-disable oxc/no-async-await -- Await the native React mount, finite Motion animation, capture and unmount lifecycle. */
test("login banner variants settle together", async () => {
  const fixture = await mount(
    <AppRouterContext.Provider value={router}>
      <MotionConfig reducedMotion="never">
        <div className="space-y-4 p-6">
          {variants.map((variant) => (
            <section key={variant}>
              <LoginCtaBanner
                message="Sign in to save your chats."
                variant={variant}
              />
              <LoginCtaBanner
                compact
                dismissible
                message="Sign in to continue."
                variant={variant}
              />
            </section>
          ))}
        </div>
      </MotionConfig>
    </AppRouterContext.Provider>
  );
  try {
    await act(async () => {
      await vi.waitFor(() => {
        const banners = fixture.container.querySelectorAll("section > div");
        expect(banners).toHaveLength(BANNER_COUNT);
        for (const banner of banners) {
          expect(getComputedStyle(banner).opacity).toBe("1");
          // oxlint-disable-next-line no-magic-numbers -- Zero is the native collapsed-height boundary; the banner must expand above it.
          expect(banner.getBoundingClientRect().height).toBeGreaterThan(0);
        }
      });
    });
    for (const link of fixture.container.querySelectorAll("a")) {
      expect(link.getAttribute("href")).toBe("/login");
    }
    await act(async () => {
      await takeSnapshot("login-banner-variants");
      await page.getByRole("main").screenshot();
    });
  } finally {
    await unmount(fixture);
  }
});

/* oxlint-disable max-lines-per-function, max-statements -- Verify independent banner instances through a rerender, dismissal and key remount under both native Motion reduction modes. */
const reductionModes: readonly ("always" | "never")[] = ["always", "never"];
test.each(reductionModes)(
  "login banner lifecycle with reduced motion %s",
  async (reducedMotion) => {
    const render = (bannerKey: string, message: string): React.JSX.Element => (
      <AppRouterContext.Provider value={router}>
        <MotionConfig reducedMotion={reducedMotion}>
          <div className="space-y-4 p-6">
            <section data-testid="dismissible-banner">
              <LoginCtaBanner key={bannerKey} dismissible message={message} />
            </section>
            <section data-testid="persistent-banner">
              <LoginCtaBanner
                message="Keep this banner visible."
                variant="amber"
              />
            </section>
          </div>
        </MotionConfig>
      </AppRouterContext.Provider>
    );
    const fixture = await mount(render("first", "Initial banner."));
    try {
      await act(async () => {
        await vi.waitFor(() => {
          const banner = fixture.container.querySelector(
            '[data-testid="dismissible-banner"] > div'
          );
          expect(banner).not.toBeNull();
          if (banner !== null) {
            expect(getComputedStyle(banner).opacity).toBe("1");
          }
        });
      });
      act(() => {
        fixture.root.render(render("first", "Updated banner."));
      });
      await expect
        .element(page.getByText("Updated banner.", { exact: false }))
        .toBeVisible();
      await act(async () => {
        await page
          .getByTestId("dismissible-banner")
          .getByRole("button")
          .click();
      });
      await expect
        .element(page.getByTestId("dismissible-banner").getByRole("link"))
        .not.toBeInTheDocument();
      await expect
        .element(page.getByText("Keep this banner visible.", { exact: false }))
        .toBeVisible();
      act(() => {
        fixture.root.render(render("first", "Still dismissed."));
      });
      await expect
        .element(page.getByText("Still dismissed.", { exact: false }))
        .not.toBeInTheDocument();
      act(() => {
        fixture.root.render(render("second", "Remounted banner."));
      });
      await act(async () => {
        await vi.waitFor(() => {
          const banner = fixture.container.querySelector(
            '[data-testid="dismissible-banner"] > div'
          );
          expect(banner).not.toBeNull();
          if (banner !== null) {
            expect(getComputedStyle(banner).opacity).toBe("1");
          }
        });
      });
      await expect
        .element(page.getByText("Remounted banner.", { exact: false }))
        .toBeVisible();
      await act(async () => {
        await takeSnapshot(`login-banner-remount-${reducedMotion}`);
        await page.getByRole("main").screenshot();
      });
    } finally {
      await unmount(fixture);
    }
  }
);
/* oxlint-enable max-lines-per-function, max-statements */
/* oxlint-enable oxc/no-async-await */

/* oxlint-enable react/jsx-max-depth */
