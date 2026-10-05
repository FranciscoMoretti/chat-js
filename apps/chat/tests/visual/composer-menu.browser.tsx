import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Toaster, toast } from "sonner";
/* oxlint-enable sort-imports */
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { EveComposer } from "@/components/eve/eve-composer";
import { useEveAttachments } from "@/components/eve/use-eve-attachments";
/* oxlint-disable import/max-dependencies -- @/components/settings/settings-nav import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { SettingsNav } from "@/components/settings/settings-nav";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { composerControls } from "@/composer-controls";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AttachmentUploadInput } from "@/lib/installation-contracts";
/* oxlint-enable sort-imports */
import type { composerTools } from "@/tools/chatjs/composer-tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import "./sandbox.css";
/* oxlint-enable sort-imports */

const state = vi.hoisted(() => ({
  attach: vi.fn(),
  authenticated: true,
  connectors: [{ enabled: true, id: "docs", name: "Documentation" }],
  error: false,
  featuresEnabled: true,
  globalConnector: false,
  handleSubmit: vi.fn(),
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including files: AttachmentUploadInput). */

vi.mock("@/features/installed-uploads", async () => {
  const { attachmentUploads } =
    await import("@/features/attachment-uploads/integration");
  const useFixtureUploads = (files: AttachmentUploadInput) => {
    const behavior = attachmentUploads.useUploads(files);
    return state.uploadsInstalled ? behavior : { uploadQueue: [] };
  };
  return {
    attachmentUploads: {
      controls: attachmentUploads.controls,
      useUploads: useFixtureUploads,
    },
  };
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- composer-menu.browser route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 24); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including file: File); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */
vi.mock("@/features/attachment-uploads/upload", () => ({
  uploadAttachment: (file: File) => {
    state.upload(file);
    return Promise.resolve({
      contentType: file.type,
      digest: "fixture",
      name: file.name,
      url: `/api/files/${String(state.upload.mock.calls.length).padStart(24, "0")}.png`,
    });
  },
}));
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: state.authenticated ? { user: { id: "fixture" } } : null,
  }),
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type -- composer-menu.browser route: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("@/providers/chat-models-provider", () => ({
  useChatModels: () => ({
    getModelById: () => ({
      input: { image: true, pdf: true, text: true },
      toolCall: state.unknownCapabilities ? undefined : state.toolCall,
    }),
  }),
}));
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */
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
/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/features/installed", () => ({
  installedFeatures: {
    has: (id: string) =>
      state.featuresEnabled &&
      (id !== "attachment-uploads" || state.uploadsInstalled),
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("@/tools/chatjs/installed-features", () => ({
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
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
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
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including connector); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: state.toggle }),
  useQuery: () => ({
    data: state.connectors.map((connector) => ({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...connector,
      userId: state.globalConnector ? null : "fixture",
    })),
    isError: state.error,
    isPending: state.pending,
  }),
  useQueryClient: () => ({}),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/connectors",
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- composer-menu.browser route: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: React.ComponentProps<"a">). */
vi.mock("@/components/internal-link", () => ({
  InternalLink: ({
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<"a">): React.JSX.Element => (
    <a {...props}>{children}</a>
  ),
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type -- composer-menu.browser route: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/tools/chatjs/composer-tools", async (importOriginal) => {
  const actual = await importOriginal<{
    composerTools: typeof composerTools;
  }>();
  return {
    composerTools: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing actual.composerTools own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...actual.composerTools,
      get webSearch() {
        return state.removedTool || state.missingMetadata
          ? undefined
          : actual.composerTools.webSearch;
      },
    },
  };
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- composer-menu.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "fixture",
}));
/* oxlint-disable react/jsx-no-literals -- render fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-enable typescript/explicit-function-return-type */

vi.mock("@/components/eve/eve-model-picker", () => ({
  EveModelPicker: (): React.JSX.Element => <button type="button">Model</button>,
}));
/* oxlint-enable react/jsx-no-literals */

const originalControls = [...composerControls];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mount's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- mount: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 350); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including ...args); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  /* oxlint-disable react/jsx-no-literals -- Fixture renders the static composer scenario caption used by this visual test. */
  const Fixture = (): ReactJSX.Element => {
    const [attachments, setAttachments] = useState(state.history);
    const files = useEveAttachments({ attachments, setAttachments });
    const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
      initialTool
    );
    if (fullComposer) {
      return (
        <>
          <Toaster />
          <EveComposer
            files={files}
            selectedTool={selectedTool}
            onToolChange={setSelectedTool}
            disabled={disabled}
            draft="Hello"
            onDraftChange={vi.fn()}
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
            onAttach={(...args) => {
              state.attach(...args);
            }}
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
  /* oxlint-enable react/jsx-no-literals */
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
  await act(() => root.render(<Fixture />));
  return async (): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
/* oxlint-disable max-statements, no-magic-numbers -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0). */

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
  state.globalConnector = false;
  state.connectors = [{ enabled: true, id: "docs", name: "Documentation" }];
  vi.clearAllMocks();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- composer-menu.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including item); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
      "application/pdf,image/jpeg,image/png"
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, typescript/promise-function-async -- composer-menu.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- composer-menu.browser route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including item); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

for (const status of ["loading", "error", "empty"] as const) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

for (const selected of ["webSearch", "editTextDocument"] as const) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- composer-menu.browser route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- composer-menu.browser route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
      .element(page.getByRole("menuitem", { name: "Clear unavailable tool" }))
      .toBeVisible();
    await act(() =>
      page.getByRole("menuitem", { name: "Clear unavailable tool" }).click()
    );
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .not.toBeInTheDocument();
  } finally {
    await selectedCleanup();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

for (const mobile of [false, true]) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- composer-menu.browser route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/promise-function-async -- composer-menu.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/no-null -- composer-menu.browser route: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

test("installed uploads handle picker, paste and drop; omitted uploads leave no input or upload handlers", async () => {
  const cleanup = await mount(false, null, true);
  try {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Missing installed upload picker");
    }
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => {
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => {
      message.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: pasted,
        })
      );
    });
    await vi.waitFor(() => expect(state.upload).toHaveBeenCalledTimes(2));
    const composer = page
      .getByRole("group", { name: "Message composer" })
      .element();
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => {
      composer.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: pasted,
        })
      );
    });
    await vi.waitFor(() => expect(state.upload).toHaveBeenCalledTimes(3));
    await expect
      .element(page.getByRole("button", { name: "Composer options" }))
      .toBeEnabled();
    const unsupported = new DataTransfer();
    unsupported.items.add(
      new File(["plain text"], "notes.txt", { type: "text/plain" })
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => {
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => {
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
    await act(() =>
      page.getByRole("button", { name: "Composer options" }).click()
    );
    await expect
      .element(page.getByRole("menuitem", { name: "Attach files" }))
      .not.toBeInTheDocument();
    await takeSnapshot("composer-uploads-omitted");
  } finally {
    await omittedCleanup();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable max-lines -- composer-menu.browser keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
