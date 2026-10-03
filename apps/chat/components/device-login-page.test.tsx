import { createElement } from "react";
import type { ComponentProps } from "react";
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

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => createElement("a", props),
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This device-login-page fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      fetchOptions = options;
      return transfer.promise;
    });

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(<DeviceLoginPage />);
    });

    expect(renderer?.root.findByType("a").props.href).toBe("/");

    const retryButton = renderer?.root.find(
      (node) => node.type === "button" && node.children.includes("Try again")
    );
    expect(retryButton).toBeDefined();

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This device-login-page fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      retryButton?.props.onClick();
    });
    expect(
      renderer?.root.findAll((node) =>
        node.children.includes("Opening the desktop app...")
      )
    ).toHaveLength(1);

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
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
