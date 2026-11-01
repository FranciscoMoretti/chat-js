import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

const configuration = vi.hoisted(() => ({
  appName: "ChatJS",
  organization: {
    name: "ChatJS",
    contact: {
      privacyEmail: "privacy@example.test",
      legalEmail: "legal@example.test",
    },
  },
  legal: { minimumAge: 18, governingLaw: "the applicable jurisdiction" },
  policies: {
    privacy: { title: "Privacy Policy", lastUpdated: "2026-10-11" },
    terms: { title: "Terms of Service", lastUpdated: "2026-10-11" },
  },
  pricing: {
    currency: "USD",
    free: { name: "Free", summary: "Free plan" },
    pro: { name: "Pro", summary: "Paid plan", monthlyPrice: 20 },
  },
  services: {
    hosting: "Example hosting",
    aiProviders: ["Example AI"],
    paymentProcessors: ["Example billing"],
  },
}));
vi.mock("@/lib/config", () => ({ config: configuration }));

test.each(["2026-10-11", ""])(
  "policy dates and currency preserve empty-value behavior (%s)",
  async (date) => {
    configuration.policies.privacy.lastUpdated = date;
    configuration.policies.terms.lastUpdated = date;
    configuration.pricing.currency = date.length > 0 ? "USD" : "";
    const fixture = await mount(
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          padding: 24,
          background: "white",
          color: "black",
          height: 800,
          overflow: "auto",
        }}
      >
        <section data-policy="privacy">
          <PrivacyPage />
        </section>
        <section data-policy="terms">
          <TermsPage />
        </section>
      </div>
    );
    try {
      const privacy = fixture.container.querySelector(
        '[data-policy="privacy"]'
      );
      const terms = fixture.container.querySelector('[data-policy="terms"]');
      expect(privacy?.textContent).toContain("Privacy Policy");
      expect(terms?.textContent).toContain("Terms of Service");
      expect(privacy?.textContent?.includes("Last updated:")).toBe(
        date.length > 0
      );
      expect(terms?.textContent?.includes("Last updated:")).toBe(
        date.length > 0
      );
      expect(terms?.textContent?.includes("$20/month")).toBe(date.length > 0);
      if (date.length > 0) {
        await takeSnapshot("policy-pages-dated");
        await page.screenshot();
      }
    } finally {
      await unmount(fixture);
    }
  }
);
