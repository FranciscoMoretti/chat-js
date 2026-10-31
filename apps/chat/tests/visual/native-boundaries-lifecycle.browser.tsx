import React, { act } from "react";
import { expect, test } from "vitest";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { createDomHarness } from "@/components/test-dom-harness";
import "@/tests/visual/sandbox.css";

const SidebarControl = (): React.JSX.Element => {
  const { setOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
      }}
    >
      Collapse
    </button>
  );
};

test("sidebar persists through the document cookie fallback when Cookie Store is unavailable", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "cookieStore");
  Reflect.deleteProperty(globalThis, "cookieStore");
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  try {
    act(() => {
      fixture = createDomHarness(
        <SidebarProvider>
          <SidebarControl />
        </SidebarProvider>
      );
    });
    act(() => {
      fixture?.container.querySelector("button")?.click();
    });
    expect(document.cookie).toContain("sidebar_state=false");
  } finally {
    act(() => {
      fixture?.unmount();
    });
    if (descriptor) {
      Object.defineProperty(globalThis, "cookieStore", descriptor);
    }
  }
});
