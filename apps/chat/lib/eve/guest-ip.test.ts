import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { guestRequestIpHash } from "@/plugins/guest-chat/guest-ip";

const mocks = vi.hoisted(() => ({
  env: {
    AUTH_SECRET: "fixture-secret",
    NODE_ENV: "development",
    VERCEL_URL: "",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
const request = new Request("http://localhost/api/eve-guest");
beforeEach(() => {
  mocks.env.NODE_ENV = "development";
  mocks.env.VERCEL_URL = "";
  vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
});
afterEach(() => vi.unstubAllEnvs());
it("does not trust arbitrary forwarded headers or alternate IP spellings for quota", () => {
  const forged = new Request(request, {
    headers: { "x-vercel-forwarded-for": "192.0.2.1" },
  });
  expect(guestRequestIpHash(forged)).toBe(guestRequestIpHash(request));
  mocks.env.NODE_ENV = "production";
  expect(() => guestRequestIpHash(forged)).toThrow("Trusted client address");
  mocks.env.VERCEL_URL = "app.vercel.app";
  const digest = (address: string): string =>
    guestRequestIpHash(
      new Request(request, { headers: { "x-vercel-forwarded-for": address } })
    );
  expect(digest("2001:0DB8:0:0:0:0:0:1")).toBe(digest("2001:db8::1"));
  expect(digest("::ffff:192.0.2.1")).toBe(digest("192.0.2.1"));
  expect(() => digest("192.0.2.1, 192.0.2.2")).toThrow();
  expect(() => digest("fe80::1%eth0")).toThrow();
});

it("self-hosted guest quotas use only the configured proxy header", () => {
  mocks.env.NODE_ENV = "production";
  vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-real-ip");
  const headers = {
    "x-forwarded-for": "198.51.100.2",
    "x-real-ip": "192.0.2.1",
  };
  const hash = guestRequestIpHash(new Request(request, { headers }));
  expect(
    guestRequestIpHash(
      new Request(request, {
        headers: { ...headers, "x-forwarded-for": "203.0.113.3" },
      })
    )
  ).toBe(hash);
  expect(() =>
    guestRequestIpHash(
      new Request(request, {
        headers: { "x-forwarded-for": "192.0.2.1" },
      })
    )
  ).toThrow("Trusted client address");
  expect(() =>
    guestRequestIpHash(
      new Request(request, {
        headers: { "x-real-ip": "192.0.2.1, 198.51.100.2" },
      })
    )
  ).toThrow("Trusted client address");
});
