import React, { act } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { InternalLink } from "@/components/internal-link";
import { createDomHarness } from "@/components/test-dom-harness";

const navigation = vi.hoisted(() => ({
  electron: false,
  push: vi.fn<(href: string) => void>(),
}));
vi.mock("@/lib/electron-auth", () => ({
  isElectronRenderer: () => navigation.electron,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

afterEach(() => {
  navigation.electron = false;
  navigation.push.mockClear();
});

test.each([
  { eventType: "click", options: { metaKey: true } },
  { eventType: "click", options: { ctrlKey: true } },
  { eventType: "click", options: { shiftKey: true } },
  { eventType: "auxclick", options: { button: 1 } },
])(
  "Electron $eventType $options routes the rendered URL object href",
  ({ eventType, options }) => {
    navigation.electron = true;
    const onNavigate = vi.fn<() => void>();
    const onClick = vi.fn<React.MouseEventHandler<HTMLAnchorElement>>();
    const onAuxClick = vi.fn<React.MouseEventHandler<HTMLAnchorElement>>();
    let fixture: ReturnType<typeof createDomHarness> | undefined;
    act(() => {
      fixture = createDomHarness(
        <InternalLink
          href={{ pathname: "/settings", query: { view: "models" } }}
          onNavigate={onNavigate}
          onClick={onClick}
          onAuxClick={onAuxClick}
          title="Settings"
          aria-label="Open settings"
          tabIndex={-1}
        >
          Settings
        </InternalLink>
      );
    });
    try {
      const anchor = fixture?.container.querySelector("a");
      expect(anchor?.getAttribute("href")).toBe("/settings?view=models");
      expect(anchor?.getAttribute("title")).toBe("Settings");
      expect(anchor?.getAttribute("aria-label")).toBe("Open settings");
      expect(anchor?.tabIndex).toBe(-1);
      // Electron follows the live anchor, even if a consumer changed it after render.
      anchor?.setAttribute("href", "/settings?view=models#edited");
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        ...options,
      });
      act(() => {
        anchor?.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
        "/settings?view=models#edited"
      );
      expect(onNavigate).toHaveBeenCalledOnce();
      expect(
        eventType === "click" ? onClick : onAuxClick
      ).toHaveBeenCalledOnce();
    } finally {
      act(() => {
        fixture?.unmount();
      });
    }
  }
);

test.each([
  { electron: false, options: {}, navigates: true },
  { electron: false, options: { metaKey: true }, navigates: false },
  { electron: true, options: { altKey: true }, navigates: false },
  { electron: true, options: {}, navigates: false, cancel: true },
])(
  "ordinary and cancelled clicks preserve navigation callbacks: %j",
  ({ electron, options, navigates, cancel }) => {
    navigation.electron = electron;
    const onNavigate = vi.fn<() => void>();
    let fixture: ReturnType<typeof createDomHarness> | undefined;
    act(() => {
      fixture = createDomHarness(
        <InternalLink
          href="/settings"
          onNavigate={onNavigate}
          onClick={(event) => {
            if (cancel === true) {
              event.preventDefault();
            }
          }}
        >
          Settings
        </InternalLink>
      );
    });
    try {
      // Stop native navigation after React's handlers have processed the event.
      fixture?.container.addEventListener("click", (event) => {
        event.preventDefault();
      });
      act(() => {
        fixture?.container.querySelector("a")?.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            ...options,
          })
        );
      });
      expect(onNavigate).toHaveBeenCalledTimes(navigates ? 1 : 0);
      expect(navigation.push).not.toHaveBeenCalled();
    } finally {
      act(() => {
        fixture?.unmount();
      });
    }
  }
);
