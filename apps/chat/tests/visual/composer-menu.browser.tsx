import { Plugins } from "@/lib/ui-slots";
import { attachmentUploadsClient } from "@/plugins/attachment-uploads/client-plugin";
import { mcpClient } from "@/plugins/mcp/client-plugin";
import { modelPreferencesClient } from "@/plugins/model-preferences/client-plugin";
import { renderRoot, unmountRoot } from "./primitive-mount";
import { disableAutoSnapshot, takeSnapshot } from "@uiverify/vitest";
import React, { act, useState } from "react";
import type { JSX as ReactJSX } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { EveComposer } from "@/components/eve/eve-composer";
import { useEveAttachments } from "@/components/eve/use-eve-attachments";
import { SettingsNav } from "@/components/settings/settings-nav";
import { composerControls } from "@/composer-controls";
import type { UiToolName } from "@/lib/ai/types";
import type { DraftAttachment } from "@/lib/eve/draft";
import type { AttachmentUploadInput } from "@/lib/installation-contracts";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { composerTools } from "@/composition/generated/composer-tools";

import "./sandbox.css";

const state = vi.hoisted(() => ({
  attach: vi.fn(),
  authenticated: true,
  connectors: [{ enabled: true, id: "docs", name: "Documentation" }],
  error: false,
  featuresEnabled: true,
  connectorsInstalled: true,
  globalConnector: false,
  handleSubmit: vi.fn<() => void>(),
  history: new Array<DraftAttachment>(),
  missingMetadata: false,
  mobile: false,
  pending: false,
  removedTool: false,
  toggle: vi.fn(),
  toolCall: true,
  unknownCapabilities: false,
  upload: vi.fn(),
  uploadsInstalled: true,
}));

vi.mock("@/composition/generated/installed-uploads", async () => {
  const { attachmentUploads } =
    await import("@/plugins/attachment-uploads/integration");
  const useFixtureUploads = (files: AttachmentUploadInput) => {
    const behavior = attachmentUploads.useUploads(files);
    if (state.uploadsInstalled) {
      return behavior;
    }
    return { uploadQueue: [] };
  };
  return {
    attachmentUploads: {
      useUploads: useFixtureUploads,
    },
  };
});

vi.mock("@/plugins/attachment-uploads/upload", () => ({
  uploadAttachment: async (file: ReadonlyNativeSurface<File>) => {
    await state.upload(file);
    return {
      contentType: file.type,
      digest: "fixture",
      name: file.name,
      url: `/api/files/${String(state.upload.mock.calls.length).padStart(24, "0")}.png`,
    };
  },
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
      input: { image: true, pdf: true, text: true },
      toolCall: state.unknownCapabilities ? undefined : state.toolCall,
    }),
  }),
}));
vi.mock("@/lib/config", () => ({
  config: {
    attachments: {
      acceptedTypes: {
        "application/pdf": [".pdf"],
        "image/jpeg": [".jpg"],
        "image/png": [".png"],
      },
      maxBytes: 1_048_576,
      maxDimension: 2048,
    },
  },
}));

vi.mock("@/composition/generated/installed", () => ({
  installedPlugins: {
    has: (id: string) =>
      state.featuresEnabled &&
      (id !== "attachment-uploads" || state.uploadsInstalled),
  },
}));

vi.mock("@/composition/generated/installed-tools", () => ({
  installedToolNames: {
    has: (name: string) =>
      state.featuresEnabled &&
      (name === "webSearch"
        ? !state.removedTool
        : [
            "createTextDocument",
            "editTextDocument",
            "deepResearch",
            "generateImage",
            "generateVideo",
          ].includes(name)),
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
    data: state.connectors.map(
      (
        connector: Readonly<{ enabled: boolean; id: string; name: string }>
      ) => ({
        ...connector,
        userId: state.globalConnector ? null : "fixture",
      })
    ),
    isError: state.error,
    isPending: state.pending,
  }),
  useQueryClient: () => ({}),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/connectors",
}));

vi.mock("@/components/internal-link", () => ({
  InternalLink: ({
    children,
    ...props
  }: React.ComponentProps<"a">): React.JSX.Element => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/composition/generated/composer-tools", async (importOriginal) => {
  const actual = await importOriginal<{
    composerTools: typeof composerTools;
  }>();
  return {
    composerTools: {
      ...actual.composerTools,
      get webSearch(): (typeof composerTools)["webSearch"] | undefined {
        if (state.removedTool || state.missingMetadata) {
          return undefined;
        }
        return actual.composerTools.webSearch;
      },
    },
  };
});

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "fixture",
}));

vi.mock("@/components/eve/eve-model-picker", () => ({
  EveModelPicker: (): React.JSX.Element => <button type="button">Model</button>,
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
  const Fixture = (): ReactJSX.Element => {
    const [attachments, setAttachments] = useState<
      readonly Readonly<DraftAttachment>[]
    >(state.history);
    const files = useEveAttachments({ attachments, setAttachments });
    const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
      initialTool
    );
    if (fullComposer) {
      return (
        <>
          <Toaster />
          <EveComposer
            capabilities={{
              files,
              selectedTool,
              onToolChange: setSelectedTool,
            }}
            disabled={disabled}
            draft="Hello"
            onDraftChange={vi.fn<(_draft: string) => void>()}
            onSubmit={state.handleSubmit}
          />
        </>
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
            onAttach={(
              ...args: readonly [
                accept: string,
                capture?: "user" | "environment",
              ]
            ) => {
              state.attach(...args);
            }}
          />
          <ActiveTool
            selectedTool={selectedTool}
            disabled={disabled}
            onClear={() => {
              setSelectedTool(null);
            }}
          />
        </div>
        <div style={{ marginTop: 384 }}>
          <SettingsNav />
        </div>
      </>
    );
  };

  const plugins = state.featuresEnabled
    ? [
        ...(state.uploadsInstalled ? [attachmentUploadsClient] : []),
        ...(state.connectorsInstalled ? [mcpClient] : []),
        modelPreferencesClient,
      ]
    : [];
  await renderRoot(
    root,
    <Plugins plugins={plugins}>
      <Fixture />
    </Plugins>
  );
  return async (): Promise<void> => {
    await unmountRoot(root);
    container.remove();
  };
};

afterEach(() => {
  toast.dismiss();
  composerControls.splice(0, composerControls.length, ...originalControls);
  state.history = [];
  state.uploadsInstalled = true;
  state.removedTool = false;
  state.missingMetadata = false;
  state.authenticated = true;
  state.toolCall = true;
  state.unknownCapabilities = false;
  state.mobile = false;
  state.pending = false;
  state.error = false;
  state.featuresEnabled = true;
  state.connectorsInstalled = true;
  state.globalConnector = false;
  state.connectors = [{ enabled: true, id: "docs", name: "Documentation" }];
  vi.clearAllMocks();
  state.upload.mockReset();
});

test("one ordered menu selects and clears tools, attaches files, and toggles connectors", async () => {
  const cleanup = await mount();
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role^="menuitem"]')].map(
          (item: { readonly textContent: string }) => item.textContent
        )
      )
      .toEqual([
        "Attach files",
        "Canvas",
        "Web Search",
        "Deep Research",
        "Create an image",
        "Create a video",
        "Connectors",
      ]);
    await act(async () => {
      await page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click();
    });
    await expect
      .element(page.getByRole("button", { name: "Clear Search tool" }))
      .toHaveTextContent("Search");
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: /Web Search/u }))
      .toBeChecked();
    await takeSnapshot("composer-selected-tool");
    await page.screenshot({
      path: "__screenshots__/composer-selected-tool.png",
    });
    await act(async () => {
      await page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click();
    });
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toHaveTextContent("Add");
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await act(async () => {
      await page
        .getByRole("menuitem", { exact: true, name: "Attach files" })
        .click();
    });
    expect(state.attach).toHaveBeenCalledWith(
      "application/pdf,image/jpeg,image/png"
    );
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await act(async () => {
      await page
        .getByRole("menuitem", { exact: true, name: "Connectors" })
        .hover();
    });
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Documentation" }))
      .toBeVisible();
    await act(async () => {
      await page
        .getByRole("menuitemcheckbox", { name: "Documentation" })
        .click();
    });
    expect(state.toggle).toHaveBeenCalledExactlyOnceWith({
      enabled: false,
      id: "docs",
    });
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Documentation" }))
      .toBeVisible();
    const connector = page
      .getByRole("menuitemcheckbox", { name: "Documentation" })
      .element();
    if (!(connector instanceof HTMLElement)) {
      throw new Error("Missing connector item");
    }
    connector.focus();
    await userEvent.keyboard("{Enter}");
    expect(state.toggle).toHaveBeenCalledTimes(2);
    await expect
      .element(page.getByRole("menuitemcheckbox", { name: "Documentation" }))
      .toBeVisible();
    await takeSnapshot("composer-connectors");
    await page.screenshot({ path: "__screenshots__/composer-connectors.png" });
  } finally {
    await cleanup();
  }
});

test.each([
  ["Attach files", "pointer"],
  ["Attach files", "keyboard"],
  ["Take photo", "pointer"],
  ["Take photo", "keyboard"],
])("%s invokes the upload control from %s", async (name, input) => {
  disableAutoSnapshot();
  state.mobile = true;
  const cleanup = await mount();
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    const item = page.getByRole("menuitem", { exact: true, name });
    await expect.element(item).toBeVisible();
    await act(async () => {
      if (input === "pointer") {
        await item.click();
      } else {
        const element = item.element();
        if (!(element instanceof HTMLElement)) {
          throw new Error("Expected upload menu item");
        }
        element.focus();
        await userEvent.keyboard("{Enter}");
      }
    });
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    expect(state.attach).toHaveBeenCalledOnce();
    if (name === "Take photo") {
      expect(state.attach).toHaveBeenLastCalledWith(
        "image/jpeg,image/png",
        "environment"
      );
    } else {
      expect(state.attach).toHaveBeenLastCalledWith(
        "application/pdf,image/jpeg,image/png"
      );
    }
  } finally {
    await cleanup();
  }
});

test("mobile camera and guest controls respect the same order; disabled composer cannot open", async () => {
  state.mobile = true;
  state.authenticated = false;
  const cleanup = await mount();
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .element(page.getByRole("menuitem", { name: "Take photo" }))
      .toBeVisible();
    await act(async () => {
      await page
        .getByRole("menuitem", { exact: true, name: "Connectors" })
        .hover();
    });
    await expect
      .element(page.getByRole("menuitem", { exact: true, name: "Sign in" }))
      .toHaveAttribute("href", "/login");
    await takeSnapshot("composer-guest-connectors");
    await act(async () => {
      await page.getByRole("menuitem", { name: "Attach files" }).hover();
    });
    await takeSnapshot("composer-mobile-guest");
    await act(async () => {
      await page.getByRole("menuitem", { name: "Attach files" }).click();
    });
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
    // Select act's completion overload for this synchronous, undefined-returning callback.
    await act<undefined>((): undefined => {
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
  state.connectorsInstalled = false;
  composerControls.splice(
    0,
    composerControls.length,
    ...originalControls
      .filter((item: { readonly id: string }) => item.id !== "mcp")
      .toReversed()
  );
  const cleanup = await mount();
  try {
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role^="menuitem"]')].map(
          (item: { readonly textContent: string }) => item.textContent
        )
      )
      .toEqual([
        "Attach files",
        "Create a video",
        "Create an image",
        "Deep Research",
        "Web Search",
        "Canvas",
      ]);
    await takeSnapshot("composer-custom-order-without-mcp");
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
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
      await act(async () => {
        await page.getByRole("button", { name: "Composer options" }).click();
      });
      await act(async () => {
        await page
          .getByRole("menuitem", { exact: true, name: "Connectors" })
          .hover();
      });
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
      await act(async () => {
        await page.getByRole("button", { name: "Composer options" }).click();
      });
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
      await act(async () => {
        await page.getByRole("menuitem", { name: /^Clear /u }).click();
      });
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
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await act(async () => {
      await page.getByRole("menuitemcheckbox", { name: /Web Search/u }).click();
    });
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
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await act(async () => {
      await page
        .getByRole("menuitem", { exact: true, name: "Connectors" })
        .hover();
    });
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
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .element(page.getByRole("menuitem", { name: "Clear unavailable tool" }))
      .toBeVisible();
    await act(async () => {
      await page
        .getByRole("menuitem", { name: "Clear unavailable tool" })
        .click();
    });
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
      await act(async () => {
        await page.getByRole("button", { name: "Clear Search tool" }).click();
      });
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
    await act(async () => {
      await page
        .getByRole("button", { name: "Clear unavailable tool" })
        .click();
    });
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
    await act(async () => {
      await message.click();
    });
    await act(async () => {
      await userEvent.keyboard("{Enter}");
    });
    expect(state.handleSubmit).not.toHaveBeenCalled();
    await act(async () => {
      await page
        .getByRole("button", { name: "Clear unavailable tool" })
        .click();
    });
    await expect
      .element(page.getByRole("button", { exact: true, name: "Send" }))
      .toBeEnabled();
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Send" }).click();
    });
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
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Send" }).click();
    });
    expect(state.handleSubmit).toHaveBeenCalledOnce();
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
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

test.each(["picker", "paste", "drop"])(
  "%s locks Send before a deferred upload completes",
  async (source) => {
    const pending = Promise.withResolvers<boolean>();
    state.upload.mockReturnValue(pending.promise);
    const cleanup = await mount(false, null, true);
    try {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array([1, 2, 3])], "pending.png", {
          type: "image/png",
        })
      );
      if (source === "picker") {
        const input =
          document.querySelector<HTMLInputElement>('input[type="file"]');
        if (!input) {
          throw new Error("Missing installed upload picker");
        }
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (source === "paste") {
        page
          .getByRole("textbox", { exact: true, name: "Message" })
          .element()
          .dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: transfer,
            })
          );
      } else {
        page
          .getByRole("group", { name: "Message composer" })
          .element()
          .dispatchEvent(
            new DragEvent("drop", {
              bubbles: true,
              cancelable: true,
              dataTransfer: transfer,
            })
          );
      }
      await vi.waitFor(() => {
        expect(state.upload).toHaveBeenCalledOnce();
      });
      await expect
        .element(page.getByRole("button", { exact: true, name: "Send" }))
        .toBeDisabled();
      await expect
        .element(page.getByRole("button", { name: "Composer options" }))
        .toBeDisabled();
      await expect
        .element(page.getByTestId("input-attachment-preview"))
        .toBeVisible();
      expect(state.handleSubmit).not.toHaveBeenCalled();
      if (source === "picker") {
        await takeSnapshot("composer-pending-upload-lock");
        await page
          .getByRole("group", { name: "Message composer" })
          .screenshot();
      }
      await act(async () => {
        await Promise.resolve();
        pending.resolve(true);
      });
      await expect
        .element(page.getByTestId("input-attachment-preview"))
        .toBeVisible();
      await expect
        .element(page.getByRole("button", { exact: true, name: "Send" }))
        .toBeEnabled();
      if (source === "picker") {
        await expect
          .element(page.getByLabelText("Attach files"))
          .toHaveValue("");
      }
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      expect(state.handleSubmit).toHaveBeenCalledOnce();
    } finally {
      pending.resolve(true);
      await cleanup();
    }
  }
);

test("installed uploads handle picker, paste and drop; omitted uploads leave no input or upload handlers", async () => {
  const cleanup = await mount(false, null, true);
  try {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Missing installed upload picker");
    }
    await act(async () => {
      await page.elementLocator(input).upload(file);
    });
    await expect
      .element(page.getByTestId("input-attachment-preview"))
      .toBeVisible();
    expect(state.upload).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toBeEnabled();
    await takeSnapshot("composer-installed-upload-preview");
    const pasted = new DataTransfer();
    pasted.items.add(file);
    expect(pasted.files).toHaveLength(1);
    const message = page
      .getByRole("textbox", { exact: true, name: "Message" })
      .element();
    await act<undefined>((): undefined => {
      message.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: pasted,
        })
      );
    });
    await vi.waitFor(() => {
      expect(state.upload).toHaveBeenCalledTimes(2);
    });
    const composer = page
      .getByRole("group", { name: "Message composer" })
      .element();
    await act<undefined>((): undefined => {
      composer.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: pasted,
        })
      );
    });
    await vi.waitFor(() => {
      expect(state.upload).toHaveBeenCalledTimes(3);
    });
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toBeEnabled();
    const unsupported = new DataTransfer();
    unsupported.items.add(
      new File(["plain text"], "notes.txt", { type: "text/plain" })
    );
    await act<undefined>((): undefined => {
      composer.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: unsupported,
        })
      );
    });
    await expect
      .element(
        page.getByText(
          "Some files could not be attached. Use images or PDFs within the upload size limit."
        )
      )
      .toBeVisible();
    expect(state.upload).toHaveBeenCalledTimes(3);
    await takeSnapshot("composer-rejected-upload");
  } finally {
    await cleanup();
  }
  state.uploadsInstalled = false;
  state.history = [
    {
      contentType: "application/pdf",
      digest: "fixture",
      name: "historical.pdf",
      url: "/api/files/abcdefghijklmnopqrstuvwx.pdf",
    },
  ];
  state.upload.mockClear();
  const omittedCleanup = await mount(false, null, true);
  try {
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await expect
      .element(page.getByTestId("input-attachment-preview"))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Send" }))
      .toBeEnabled();
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["fixture"], "photo.png", { type: "image/png" })
    );
    const composer = page
      .getByRole("group", { name: "Message composer" })
      .element();
    const message = page
      .getByRole("textbox", { exact: true, name: "Message" })
      .element();
    await act<undefined>((): undefined => {
      composer.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        })
      );
      message.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        })
      );
    });
    expect(state.upload).not.toHaveBeenCalled();
    await act(async () => {
      await page.getByRole("button", { name: "Composer options" }).click();
    });
    await expect
      .element(page.getByRole("menuitem", { name: "Attach files" }))
      .not.toBeInTheDocument();
    await takeSnapshot("composer-uploads-omitted");
  } finally {
    await omittedCleanup();
  }
});
