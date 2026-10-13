import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { createDomHarness } from "@/components/test-dom-harness";
import "@/tests/visual/sandbox.css";

const motion = vi.hoisted(() => ({
  animate: vi.fn<(element: HTMLElement) => { stop: () => void }>(),
}));
vi.mock("motion/react", () => ({ useAnimate: () => [null, motion.animate] }));

test("polymorphic shimmer stops the previous element animation and binds its replacement", () => {
  const stops: ReturnType<typeof vi.fn<() => void>>[] = [];
  motion.animate.mockImplementation(() => {
    const stop = vi.fn<() => void>();
    stops.push(stop);
    return { stop };
  });
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    fixture = createDomHarness(<Shimmer as="span">Working</Shimmer>);
  });
  try {
    expect(motion.animate.mock.calls.at(-1)?.[0].tagName).toBe("SPAN");
    act(() => {
      fixture?.update(<Shimmer as="p">Working</Shimmer>);
    });
    expect(stops[0]).toHaveBeenCalledOnce();
    expect(motion.animate.mock.calls.at(-1)?.[0].tagName).toBe("P");
    act(() => {
      fixture?.unmount();
    });
    fixture = undefined;
    expect(stops[1]).toHaveBeenCalledOnce();
  } finally {
    act(() => {
      fixture?.unmount();
    });
    motion.animate.mockClear();
  }
});

test("button sizing counts opaque empty slots and nested arrays without flattening fragments", () => {
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    fixture = createDomHarness(
      <>
        <PromptInputButton aria-label="Empty slot">
          {null}
          <span>Send</span>
        </PromptInputButton>
        <PromptInputButton aria-label="Nested array">
          {[[<span key="send">Send</span>, false]]}
        </PromptInputButton>
        <PromptInputButton aria-label="Fragment">
          <>
            <span>A</span>
            <span>B</span>
          </>
        </PromptInputButton>
      </>
    );
  });
  try {
    expect(
      fixture?.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Empty slot"]'
      )?.dataset.size
    ).toBe("sm");
    expect(
      fixture?.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Nested array"]'
      )?.dataset.size
    ).toBe("sm");
    expect(
      fixture?.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Fragment"]'
      )?.dataset.size
    ).toBe("icon-sm");
  } finally {
    act(() => {
      fixture?.unmount();
    });
  }
});

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
