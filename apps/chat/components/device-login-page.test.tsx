import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceLoginPage } from "./device-login-page";

const mocks = vi.hoisted(() => ({
  transferUser: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  default: {
    electron: { transferUser: mocks.transferUser },
    getSession: vi.fn(),
  },
}));

const searchParams = new URLSearchParams("done=1");

vi.mock("next/navigation", () => ({
  usePathname: () => "/device-login",
  useSearchParams: () => searchParams,
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
    mocks.transferUser.mockImplementation(({ fetchOptions: options }) => {
      fetchOptions = options;
      return transfer.promise;
    });

    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(<DeviceLoginPage />);
    });

    const retryButton = renderer?.root.find(
      (node) => node.type === "button" && node.children.includes("Try again")
    );
    expect(retryButton).toBeDefined();

    act(() => {
      retryButton?.props.onClick();
    });
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(1);

    act(() => {
      fetchOptions?.onError?.();
    });
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("You're signed in")
      )
    ).toHaveLength(1);
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(0);
  });
});
