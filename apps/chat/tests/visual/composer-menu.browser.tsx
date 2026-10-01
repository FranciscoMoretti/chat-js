import { takeSnapshot } from "@uiverify/vitest";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { EveComposer } from "@/components/eve/eve-composer";
import { SettingsNav } from "@/components/settings/settings-nav";
import { composerControls } from "@/composer-controls";
import type { UiToolName } from "@/lib/ai/types";
import type { composerTools } from "@/tools/chatjs/composer-tools";

import "./sandbox.css";

const state = vi.hoisted(() => ({
  attach: vi.fn(),
  authenticated: true,
  connectors: [{ enabled: true, id: "docs", name: "Documentation" }],
  error: false,
  featuresEnabled: true,
  globalConnector: false,
  handleSubmit: vi.fn(),
  missingMetadata: false,
  mobile: false,
  pending: false,
  removedTool: false,
  toggle: vi.fn(),
  toolCall: true,
  unknownCapabilities: false,
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: state.authenticated ? { user: { id: "fixture" } } : null,
  }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({
    getModelById: () => ({
      input: { text: true },
      toolCall: state.unknownCapabilities ? undefined : state.toolCall,
    }),
  }),
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: {
      tools: {
        deepResearch: {
          get enabled() {
            return state.featuresEnabled;
          },
        },
        documents: {
          get enabled() {
            return state.featuresEnabled;
          },
          types: { text: true },
        },
        image: {
          get enabled() {
            return state.featuresEnabled;
          },
        },
        video: {
          get enabled() {
            return state.featuresEnabled;
          },
        },
        webSearch: {
          get enabled() {
            return state.featuresEnabled;
          },
        },
      },
    },
    features: {
      get attachments() {
        return state.featuresEnabled;
      },
    },
  },
}));
vi.mock("@/features/installed", () => ({
  installedFeatures: { has: () => state.featuresEnabled },
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedToolNames: {
    has: (name: string) =>
      name === "webSearch"
        ? !state.removedTool
        : [
            "createTextDocument",
            "editTextDocument",
            "deepResearch",
            "generateImage",
            "generateVideo",
          ].includes(name),
  },
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
    data: state.connectors.map((connector) => ({
      ...connector,
      userId: state.globalConnector ? null : "fixture",
    })),
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

vi.mock("@/tools/chatjs/composer-tools", async (importOriginal) => {
  const actual = await importOriginal<{
    composerTools: typeof composerTools;
  }>();
  return {
    composerTools: {
      ...actual.composerTools,
      get webSearch() {
        return state.removedTool || state.missingMetadata
          ? undefined
          : actual.composerTools.webSearch;
      },
    },
  };
});

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "fixture",
}));
vi.mock("@/components/eve/eve-model-picker", () => ({
  EveModelPicker: () => <button type="button">Model</button>,
}));

const originalControls = [...composerControls];
const mount = async (
  disabled = false,
  initialTool: UiToolName | null = null,
  fullComposer = false
) => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = `padding:32px;width:${state.mobile ? 350 : 900}px;min-height:540px;background:#171717`;
  document.body.append(container);
  const root = createRoot(container);
  const Fixture = () => {
    const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
      initialTool
    );
    if (fullComposer) {
      return (
        <EveComposer
          files={{
            attachments: [],
            setAttachments: vi.fn(),
            upload: vi.fn().mockResolvedValue(undefined),
            uploadQueue: [],
          }}
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          disabled={disabled}
          draft="Hello"
          onDraftChange={vi.fn()}
          onSubmit={state.handleSubmit}
        />
      );
    }
    return (
      <>
        <style>
          {"* { animation: none !important; transition: none !important; }"}
        </style>
        <Toaster />
        <h1 style={{ marginBottom: 32 }}>Composer options</h1>
        <div className="@container flex items-center gap-2">
          <ComposerMenu
            disabled={disabled}
            selectedModelId="fixture"
            selectedTool={selectedTool}
            onToolChange={setSelectedTool}
            onAttach={(...args) => state.attach(...args)}
          />
          <ActiveTool
            selectedTool={selectedTool}
            disabled={disabled}
            onClear={() => setSelectedTool(null)}
          />
        </div>
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
  state.removedTool = false;
  state.missingMetadata = false;
  state.authenticated = true;
  state.toolCall = true;
  state.unknownCapabilities = false;
  state.mobile = false;
  state.pending = false;
  state.error = false;
  state.featuresEnabled = true;
  state.globalConnector = false;
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
      page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Clear Search tool" }))
      .toHaveTextContent("Search");
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: /Web Search/u }))
      .toBeChecked();
    await takeSnapshot("composer-selected-tool");
    await act(() =>
      page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click()
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
    await act(() =>
      page.getByRole("menuitem", { exact: true, name: "Connectors" }).hover()
    );
    await expect
      .element(page.getByRole("menuitem", { exact: true, name: "Sign in" }))
      .toHaveAttribute("href", "/login");
    await takeSnapshot("composer-guest-connectors");
    await act(() =>
      page.getByRole("menuitem", { name: "Attach files" }).hover()
    );
    await takeSnapshot("composer-mobile-guest");
    await act(() =>
      page.getByRole("menuitem", { name: "Attach files" }).click()
    );
    expect(state.attach).not.toHaveBeenCalled();
    await expect
      .element(page.getByRole("link", { exact: true, name: "Sign in" }))
      .toHaveAttribute("href", "/login");
    await takeSnapshot("composer-guest-sign-in");
  } finally {
    await cleanup();
  }
  const disabledCleanup = await mount(true);
  try {
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toBeDisabled();
    await act(() => {
      const trigger = page
        .getByRole("button", { name: "Composer options" })
        .element();
      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error("Expected the composer button");
      }
      trigger.click();
    });
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
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

for (const selected of ["webSearch", "editTextDocument"] as const) {
  test(`can clear ${selected} after signing out and switching to a model without tools`, async () => {
    state.authenticated = false;
    state.toolCall = false;
    const cleanup = await mount(false, selected);
    try {
      await act(() =>
        page.getByRole("button", { name: "Composer options" }).click()
      );
      await expect
        .element(
          page.getByRole("menuitemcheckbox", { name: "Create an image" })
        )
        .toHaveAttribute("aria-disabled", "true");
      if (selected === "editTextDocument") {
        await expect
          .element(page.getByRole("menuitemcheckbox", { name: /^Canvas/u }))
          .toBeChecked();
      }
      await expect
        .element(
          page.getByRole("menuitemcheckbox", { name: /Create an image/u })
        )
        .toHaveTextContent("not supported");
      await takeSnapshot(`composer-clear-${selected}`);
      await act(() => page.getByRole("menuitem", { name: /^Clear /u }).click());
      await expect
        .element(page.getByRole("button", { name: "Composer options" }))
        .toHaveTextContent("Add");
    } finally {
      await cleanup();
    }
  });
}

test("missing catalog capability metadata does not block tool selection", async () => {
  state.unknownCapabilities = true;
  const cleanup = await mount();
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await act(() =>
      page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Clear Search tool" }))
      .toHaveTextContent("Search");
  } finally {
    await cleanup();
  }
});

test("global connectors remain visible but cannot invoke the own-only toggle", async () => {
  state.globalConnector = true;
  const cleanup = await mount();
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await act(() =>
      page.getByRole("menuitem", { exact: true, name: "Connectors" }).hover()
    );
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Documentation" }))
      .toHaveAttribute("aria-disabled", "true");
    await takeSnapshot("composer-global-connectors");
    expect(state.toggle).not.toHaveBeenCalled();
  } finally {
    await cleanup();
  }
});

test("no available controls hides the menu but still allows clearing a restored selection", async () => {
  state.featuresEnabled = false;
  const cleanup = await mount();
  try {
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .not.toBeInTheDocument();
    await takeSnapshot("composer-no-controls");
  } finally {
    await cleanup();
  }
  const selectedCleanup = await mount(false, "webSearch");
  try {
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(page.getByRole("menuitem", { name: "Clear Search" }))
      .toBeVisible();
    await act(() =>
      page.getByRole("menuitem", { name: "Clear Search" }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .not.toBeInTheDocument();
  } finally {
    await selectedCleanup();
  }
});

for (const mobile of [false, true]) {
  test(`active pill clears selection without opening the menu (${mobile ? "mobile" : "desktop"})`, async () => {
    state.mobile = mobile;
    composerControls.reverse();
    const cleanup = await mount(false, "webSearch");
    try {
      await expect
        .element(page.getByRole("button", { name: "Composer options" }))
        .toHaveTextContent("Add");
      await expect
        .element(page.getByRole("button", { name: "Clear Search tool" }))
        .toBeVisible();
      await takeSnapshot(
        `composer-active-pill-${mobile ? "mobile" : "desktop"}`
      );
      await act(() =>
        page.getByRole("button", { name: "Clear Search tool" }).click()
      );
      await expect
        .element(page.getByRole("button", { name: "Clear Search tool" }))
        .not.toBeInTheDocument();
      await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    } finally {
      await cleanup();
    }
  });
}

test("removed tool keeps a clearable unavailable pill", async () => {
  state.removedTool = true;
  const cleanup = await mount(false, "webSearch");
  try {
    await expect
      .element(page.getByRole("button", { name: "Clear unavailable tool" }))
      .toBeVisible();
    await takeSnapshot("composer-unavailable-tool");
    await act(() =>
      page.getByRole("button", { name: "Clear unavailable tool" }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Clear unavailable tool" }))
      .not.toBeInTheDocument();
  } finally {
    await cleanup();
  }
});

test("unavailable restored tool blocks submission until cleared", async () => {
  state.removedTool = true;
  const cleanup = await mount(false, "webSearch", true);
  try {
    await expect
      .element(page.getByRole("button", { exact: true, name: "Send" }))
      .toBeDisabled();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("selected tool is unavailable");
    await takeSnapshot("composer-unavailable-submission");
    const message = page.getByRole("textbox", { exact: true, name: "Message" });
    await act(() => message.click());
    await act(() => userEvent.keyboard("{Enter}"));
    expect(state.handleSubmit).not.toHaveBeenCalled();
    await act(() =>
      page.getByRole("button", { name: "Clear unavailable tool" }).click()
    );
    await expect
      .element(page.getByRole("button", { exact: true, name: "Send" }))
      .toBeEnabled();
    await act(() =>
      page.getByRole("button", { exact: true, name: "Send" }).click()
    );
    expect(state.handleSubmit).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("installed tool without display metadata remains selectable and can send", async () => {
  state.missingMetadata = true;
  const cleanup = await mount(false, "webSearch", true);
  try {
    await expect
      .element(page.getByRole("button", { name: "Clear webSearch tool" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Send" }))
      .toBeEnabled();
    await act(() =>
      page.getByRole("button", { exact: true, name: "Send" }).click()
    );
    expect(state.handleSubmit).toHaveBeenCalledOnce();
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(
        page.getByRole("menuitemcheckbox", { exact: true, name: "webSearch" })
      )
      .toBeChecked();
    await takeSnapshot("composer-missing-display-metadata");
  } finally {
    await cleanup();
  }
});
