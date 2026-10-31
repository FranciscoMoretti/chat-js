import React from "react";
import { createDomHarness } from "@/components/test-dom-harness";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceLoginPage } from "@/plugins/desktop/device-login-page";

const mocks = vi.hoisted(() => ({
  transferUser:
    vi.fn<
      (
        args: Readonly<{ fetchOptions?: Readonly<{ onError?: () => void }> }>
      ) => Promise<{ done: true }>
    >(),
}));

vi.mock("@/plugins/desktop/desktop-auth-client", () => ({
  default: {
    electron: { transferUser: mocks.transferUser },
    getSession: vi.fn(),
  },
}));
const searchParams = new URLSearchParams("done=1");

vi.mock("next/navigation", () => ({
  usePathname: (): string => "/device-login",
  useSearchParams: (): URLSearchParams => searchParams,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  mocks.transferUser.mockReset();
});

describe("device login page", () => {
  it("shows retry transfer progress and returns to waiting after onError", () => {
    const transfer = Promise.withResolvers<{ done: true }>();
    let fetchOptions:
      | {
          onError?: () => void;
        }
      | undefined;
    mocks.transferUser.mockImplementation(async ({ fetchOptions: options }) => {
      fetchOptions = options;
      return await transfer.promise;
    });

    let renderer: ReturnType<typeof createDomHarness> | undefined;
    React.act(() => {
      renderer = createDomHarness(<DeviceLoginPage />);
    });

    expect(renderer?.container.querySelector("a")?.getAttribute("href")).toBe(
      "/"
    );
    const retryButton = [
      ...(renderer?.container.querySelectorAll("button") ?? []),
    ].find((button) => button.textContent === "Try again");
    expect(retryButton).toBeDefined();

    React.act(() => {
      retryButton?.click();
    });
    expect(
      renderer?.container.textContent?.match(/Opening the desktop app\.\.\./gu)
    ).toHaveLength(1);

    React.act(() => {
      fetchOptions?.onError?.();
    });
    expect(
      renderer?.container.textContent?.match(/You're signed in/gu)
    ).toHaveLength(1);
    expect(renderer?.container.textContent).not.toContain(
      "Opening the desktop app..."
    );
    React.act(() => {
      renderer?.unmount();
    });
  });
});
