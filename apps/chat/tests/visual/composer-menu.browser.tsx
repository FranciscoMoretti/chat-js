import { takeSnapshot } from "@uiverify/vitest";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ComposerMenu } from "@/components/composer/composer-menu";
import { SettingsNav } from "@/components/settings/settings-nav";
import { composerControls } from "@/composer-controls";
import type { UiToolName } from "@/lib/ai/types";

import "./sandbox.css";

const state = vi.hoisted(() => ({
  attach: vi.fn(),
  authenticated: true,
  connectors: [{ enabled: true, id: "docs", name: "Documentation" }],
  error: false,
  mobile: false,
  pending: false,
  toggle: vi.fn(),
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: state.authenticated ? { user: { id: "fixture" } } : null,
  }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({ getModelById: () => ({ input: { text: true } }) }),
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: {
      tools: {
        deepResearch: { enabled: true },
        documents: { enabled: true, types: { text: true } },
        image: { enabled: true },
        mcp: { enabled: true },
        video: { enabled: true },
        webSearch: { enabled: true },
      },
    },
    features: { attachments: true },
  },
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedToolNames: new Set([
    "createTextDocument",
    "webSearch",
    "deepResearch",
    "generateImage",
    "generateVideo",
  ]),
}));
vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({
    mcp: {
      listConnected: {
        queryKey: () => ["connectors"],
        queryOptions: () => ({}),
      },
      toggleEnabled: { mutationOptions: () => ({}) },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: state.toggle }),
  useQuery: () => ({
    data: state.connectors,
    isError: state.error,
    isPending: state.pending,
  }),
  useQueryClient: () => ({}),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/connectors",
}));
vi.mock("@/components/internal-link", () => ({
  InternalLink: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

const originalControls = [...composerControls];
const mount = async (disabled = false) => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = `padding:32px;width:${state.mobile ? 350 : 900}px;min-height:540px;background:#171717`;
  document.body.append(container);
  const root = createRoot(container);
  const Fixture = () => {
    const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
    return (
      <>
        <style>
          {"* { animation: none !important; transition: none !important; }"}
        </style>
        <h1 style={{ marginBottom: 32 }}>Composer options</h1>
        <ComposerMenu
          disabled={disabled}
          selectedModelId="fixture"
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          onAttach={(...args) => state.attach(...args)}
        />
        <div style={{ marginTop: 384 }}>
          <SettingsNav />
        </div>
      </>
    );
  };
  await act(() => root.render(<Fixture />));
  return async () => {
    await act(() => root.unmount());
    container.remove();
  };
};
afterEach(() => {
  composerControls.splice(0, composerControls.length, ...originalControls);
  state.authenticated = true;
  state.mobile = false;
  state.pending = false;
  state.error = false;
  state.connectors = [{ enabled: true, id: "docs", name: "Documentation" }];
  vi.clearAllMocks();
});

test("one ordered menu selects and clears tools, attaches files, and toggles connectors", async () => {
  const cleanup = await mount();
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    expect(
      [...document.querySelectorAll('[role^="menuitem"]')].map(
        (item) => item.textContent
      )
    ).toEqual([
      "Attach files",
      "Canvas",
      "Web Search",
      "Deep Research",
      "Create an image",
      "Create a video",
      "Connectors",
    ]);
    await act(() =>
      page.getByRole("menuitemcheckbox", { name: "Web Search" }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toHaveTextContent("Search");
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Web Search" }))
      .toBeChecked();
    await takeSnapshot("composer-selected-tool");
    await act(() =>
      page.getByRole("menuitemcheckbox", { name: "Web Search" }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toHaveTextContent("Add");
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await act(() =>
      page.getByRole("menuitem", { exact: true, name: "Attach files" }).click()
    );
    expect(state.attach).toHaveBeenCalledWith(
      "image/jpeg,image/png,application/pdf"
    );
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await act(() =>
      page.getByRole("menuitem", { exact: true, name: "Connectors" }).hover()
    );
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Documentation" }))
      .toBeVisible();
    await act(() =>
      page.getByRole("menuitemcheckbox", { name: "Documentation" }).click()
    );
    expect(state.toggle).toHaveBeenCalledWith({ enabled: false, id: "docs" });
    await takeSnapshot("composer-connectors");
  } finally {
    await cleanup();
  }
});

test("mobile camera and guest controls respect the same order; disabled composer cannot open", async () => {
  state.mobile = true;
  state.authenticated = false;
  const cleanup = await mount();
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(page.getByRole("menuitem", { name: "Take photo" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { exact: true, name: "Connectors" }))
      .toHaveAttribute("aria-disabled", "true");
    await takeSnapshot("composer-mobile-guest");
    await act(() =>
      page.getByRole("menuitem", { name: "Attach files" }).click()
    );
    expect(state.attach).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
  const disabledCleanup = await mount(true);
  try {
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toBeDisabled();
  } finally {
    await disabledCleanup();
  }
});

test("custom ordering and omitted MCP need no placeholder", async () => {
  composerControls.splice(
    0,
    composerControls.length,
    ...originalControls.filter((item) => item.id !== "mcp").toReversed()
  );
  const cleanup = await mount();
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    expect(
      [...document.querySelectorAll('[role^="menuitem"]')].map(
        (item) => item.textContent
      )
    ).toEqual([
      "Create a video",
      "Create an image",
      "Deep Research",
      "Web Search",
      "Canvas",
      "Attach files",
    ]);
    await takeSnapshot("composer-custom-order-without-mcp");
    await act(() => userEvent.keyboard("{Escape}"));
  } finally {
    await cleanup();
  }
});

for (const status of ["loading", "error", "empty"] as const) {
  test(`connectors ${status} keeps management reachable`, async () => {
    state.pending = status === "loading";
    state.error = status === "error";
    state.connectors = [];
    const cleanup = await mount();
    try {
      await act(() =>
        page.getByRole("button", { name: "Composer options" }).click()
      );
      await act(() =>
        page.getByRole("menuitem", { exact: true, name: "Connectors" }).hover()
      );
      const messages = {
        empty: "No connected servers",
        error: "Could not load connectors",
        loading: "Loading connectors…",
      };
      await expect.element(page.getByText(messages[status])).toBeVisible();
      await expect
        .element(page.getByRole("menuitem", { name: "Manage connectors" }))
        .toBeVisible();
      await takeSnapshot(`composer-connectors-${status}`);
    } finally {
      await cleanup();
    }
  });
}
