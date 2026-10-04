import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { McpCreateDialog } from "@/components/settings/mcp-create-dialog";
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
/* oxlint-disable import/max-dependencies -- @/components/settings/settings-page import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
/* oxlint-enable import/max-dependencies */

import "./sandbox.css";

/* oxlint-disable typescript/explicit-function-return-type -- mocks: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const mocks = vi.hoisted(() => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.hoisted must initialize the mock factory before module imports.
  const query = (name: string) => ({
    queryKey: () => [name],
    queryOptions: () => ({ queryKey: [name] }),
  });
  const mutation = { mutationOptions: () => ({}) };
  return {
    approvalRequired: false,
    cachedData: false,
    handleClose: vi.fn(),
    listError: false,
    mcp: {
      authorize: mutation,
      checkAuth: query("checkAuth"),
      create: mutation,
      delete: mutation,
      disconnect: mutation,
      discover: query("discover"),
      list: query("list"),
      listConnected: query("listConnected"),
      testConnection: query("testConnection"),
      toggleEnabled: mutation,
      update: mutation,
    },
    mutate: vi.fn(),
    needsOAuth: false,
    pendingAuthorization: false,
    queryClient: { invalidateQueries: vi.fn() },
    refetch: vi.fn(),
    router: { push: vi.fn(), replace: vi.fn() },
    search: new URLSearchParams(),
    sharedConnector: false,
  };
});
/* oxlint-enable typescript/explicit-function-return-type */

afterEach(async () => {
  await act(() => toast.dismiss());
  mocks.approvalRequired = false;
  mocks.sharedConnector = false;
  mocks.listError = false;
  mocks.cachedData = false;
  mocks.needsOAuth = false;
  mocks.pendingAuthorization = false;
  vi.clearAllMocks();
  mocks.search = new URLSearchParams();
});

/* oxlint-disable unicorn/no-null -- connector: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
const connector = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  enabled: true,
  id: "documentation",
  name: "Documentation server",
  nameId: "documentation",
  oauthClientId: null,
  oauthClientSecret: null,
  requireApproval: false,
  type: "sse" as const,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  url: "https://docs.example.test/mcp",
  userId: "fixture-owner",
};
/* oxlint-enable unicorn/no-null */
vi.mock("@/features/installed", () => ({
  installedFeatures: new Set(["mcp"]),
}));
/* oxlint-disable typescript/explicit-function-return-type -- mcp-settings.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/trpc/react", () => ({ useTRPC: () => ({ mcp: mocks.mcp }) }));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- mcp-settings.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.search,
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/nuqs/mcp-search-params", () => ({
  mcpConnectorsSettingsSearchParams: {},
}));
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- mcp-settings.browser route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

vi.mock("nuqs", () => ({
  useQueryStates: () => [{ connectorId: null, dialog: null }, vi.fn()],
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- mcp-settings.browser route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { queryKey }: { queryKey: string[] }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: mocks.pendingAuthorization,
    mutate: mocks.mutate,
  }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const responses: Record<string, unknown> = {
      checkAuth: { isAuthenticated: true },
      discover: {
        prompts: [{ name: "summarize" }],
        resources: [{ name: "Documentation", uri: "docs://reference" }],
        tools: [{ name: "search_docs" }, { name: "read_page" }],
      },
      list: [
        {
          ...connector,
          requireApproval: mocks.approvalRequired,
          userId: mocks.sharedConnector ? null : connector.userId,
        },
        {
          ...connector,
          id: "global",
          name: "Shared reference server",
          userId: null,
        },
      ],
      testConnection: { needsAuth: false, status: "connected" },
    };
    let error = null;
    if (queryKey[0] === "list" && mocks.listError) {
      error = { message: "Missing credentials for mcp: MCP_ENCRYPTION_KEY" };
    }
    if (queryKey[0] === "discover" && mocks.needsOAuth) {
      error = {
        data: { code: "UNAUTHORIZED" },
        message: "Connector requires OAuth authorization",
      };
    }
    return {
      data:
        queryKey[0] === "list" && mocks.listError && !mocks.cachedData
          ? undefined
          : responses[queryKey[0]],
      error,
      isLoading: false,
      refetch: mocks.refetch,
    };
  },
  useQueryClient: () => mocks.queryClient,
}));
/* oxlint-enable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable max-statements, typescript/strict-void-return -- renderPage: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const renderPage = async (
  details: boolean,
  create = false,
  connect = false
) => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("div");
  container.className = "flex h-[850px] w-[900px] flex-col p-8";
  document.body.append(container);
  const root = createRoot(container);
  let content = <ConnectorsSettings />;
  if (details) {
    content = <McpDetailsPage connectorId="documentation" />;
  }
  if (create) {
    content = <McpCreateDialog onClose={mocks.handleClose} open />;
  }
  if (connect) {
    content = (
      <McpConnectDialog
        connector={connector}
        onClose={mocks.handleClose}
        open
      />
    );
  }
  // Render each route's client subtree with the same header/layout, without the server prefetch wrapper.
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
  await act(() =>
    root.render(
      <SettingsPage>
        <SettingsPageHeader>
          <h2 className="text-lg font-semibold">
            {details ? "Connector details" : "Connectors & MCP"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {details
              ? "Tools, resources, and authorization status."
              : "Connect to Model Context Protocol servers to extend AI capabilities with external tools."}
          </p>
        </SettingsPageHeader>
        <Toaster position="top-center" theme="dark" />
        {content}
      </SettingsPage>
    )
  );
  return async (): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act returns a runtime thenable even for the legacy synchronous overload; await it to flush updates before assertions or teardown.
    await act(() => root.unmount());
    container.remove();
  };
};
/* oxlint-enable max-statements, typescript/strict-void-return */

test("connector list shows custom and shared connectors with their management links", async () => {
  const cleanup = await renderPage(false);
  try {
    await expect
      .element(page.getByRole("heading", { name: "Connectors & MCP" }))
      .toBeVisible();
    await expect
      .element(page.getByText("Documentation server", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Shared reference server", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Add custom connector" }))
      .toBeEnabled();
    await expect
      .element(page.getByRole("link", { name: "Configure" }))
      .toHaveAttribute("href", "/settings/connectors/documentation");
    await expect
      .element(page.getByRole("link", { exact: true, name: "View" }))
      .toHaveAttribute("href", "/settings/connectors/global");
    await takeSnapshot("mcp-connectors-list");
  } finally {
    await cleanup();
  }
});

test("connector details show discovery, owner controls and the back link", async () => {
  const cleanup = await renderPage(true);
  try {
    await expect
      .element(page.getByRole("heading", { name: "Connector details" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Back" }))
      .toHaveAttribute("href", "/settings/connectors");
    await expect
      .element(page.getByRole("switch", { name: "Enabled" }))
      .toBeChecked();
    await expect
      .element(page.getByRole("button", { name: "Uninstall" }))
      .toBeEnabled();
    for (const name of [
      "search_docs",
      "read_page",
      "Documentation",
      "summarize",
    ]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each discovery section to settle before capture.
      await expect.element(page.getByText(name, { exact: true })).toBeVisible();
    }
    await takeSnapshot("mcp-connector-details");
  } finally {
    await cleanup();
  }
});

for (const details of [false, true]) {
  test(`connector ${details ? "details" : "list"} displays missing credentials instead of an empty state`, async () => {
    mocks.listError = true;
    const cleanup = await renderPage(details);
    try {
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Missing credentials for mcp: MCP_ENCRYPTION_KEY");
      await expect
        .element(page.getByText("No custom connectors", { exact: true }))
        .not.toBeInTheDocument();
      await expect
        .element(page.getByText("Connector not found", { exact: true }))
        .not.toBeInTheDocument();
      await takeSnapshot(`mcp-${details ? "details" : "list"}-setup-error`);
    } finally {
      mocks.listError = false;
      await cleanup();
    }
  });
}

for (const details of [false, true]) {
  test(`cached ${details ? "details" : "list"} remains usable after a background refresh error`, async () => {
    mocks.listError = true;
    mocks.cachedData = true;
    const cleanup = await renderPage(details);
    try {
      await expect
        .element(page.getByText("Documentation server", { exact: true }))
        .toBeVisible();
      await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
      await takeSnapshot(`mcp-${details ? "details" : "list"}-refresh-error`);
    } finally {
      mocks.listError = false;
      mocks.cachedData = false;
      await cleanup();
    }
  });
}

test("expired OAuth discovery offers reconnect instead of a permanent spinner", async () => {
  mocks.needsOAuth = true;
  const cleanup = await renderPage(true);
  try {
    await expect
      .element(page.getByRole("button", { exact: true, name: "Connect" }))
      .toBeEnabled();
    await takeSnapshot("mcp-details-reconnect");
  } finally {
    mocks.needsOAuth = false;
    await cleanup();
  }
});
/* oxlint-disable max-statements, typescript/promise-function-async -- mcp-settings.browser route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

test("custom connector advanced settings expose transport and credentials and reject a blank name", async () => {
  const cleanup = await renderPage(false, true);
  try {
    await act(() =>
      page.getByRole("button", { name: "Advanced settings" }).click()
    );
    await expect
      .element(page.getByText("Transport Type", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText("OAuth Client Secret (optional)"))
      .toBeVisible();
    await act(() => page.getByPlaceholder("Name", { exact: true }).fill("   "));
    await act(() =>
      page
        .getByPlaceholder("Remote MCP server URL")
        .fill("https://docs.example.test/mcp")
    );
    await act(() =>
      page.getByRole("button", { exact: true, name: "Add" }).click()
    );
    await expect
      .element(page.getByText("Name is required", { exact: true }))
      .toBeVisible();
    await takeSnapshot("mcp-create-advanced-validation");
  } finally {
    await cleanup();
  }
});
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- mcp-settings.browser route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

test("pending OAuth can be dismissed", async () => {
  mocks.pendingAuthorization = true;
  const cleanup = await renderPage(false, false, true);
  try {
    await expect
      .element(page.getByRole("button", { exact: true, name: "Cancel" }))
      .toBeEnabled();
    await expect
      .element(page.getByRole("dialog"))
      .toHaveStyle({ opacity: "1" });
    await takeSnapshot("mcp-connect-pending-cancellable");
    await act(() =>
      page.getByRole("button", { exact: true, name: "Cancel" }).click()
    );
    expect(mocks.handleClose).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- mcp-settings.browser route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

test("dismissed OAuth ignores a late authorization result", async () => {
  const cleanup = await renderPage(false, false, true);
  try {
    await act(() =>
      page
        .getByRole("button", { name: "Continue to Documentation server" })
        .click()
    );
    const [[, callbacks]] = mocks.mutate.mock.calls;
    await act(() =>
      page.getByRole("button", { exact: true, name: "Cancel" }).click()
    );
    await act(() =>
      // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return -- Invoke the success callback captured from the real mutation call; this fixture tests how the component handles both valid and invalid authorization URLs.
      callbacks.onSuccess({
        authorizationUrl: "https://authorization.example.test",
      })
    );
    expect(globalThis.location.hostname).not.toBe("authorization.example.test");
  } finally {
    await cleanup();
  }
});
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- mcp-settings.browser route: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { clientId, expectedClientId }); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

test.each([
  { clientId: "   ", expectedClientId: undefined },
  { clientId: " client id ", expectedClientId: " client id " },
])(
  "optional credentials preserve opaque bytes ($clientId)",
  async ({ clientId, expectedClientId }) => {
    const cleanup = await renderPage(false, true);
    try {
      await act(() =>
        page.getByRole("button", { name: "Advanced settings" }).click()
      );
      await act(() =>
        page.getByLabelText("Name", { exact: true }).fill("Server")
      );
      await act(() =>
        page
          .getByLabelText("URL", { exact: true })
          .fill("https://mcp.example.test")
      );
      await act(() =>
        page.getByLabelText("OAuth Client ID (optional)").fill(clientId)
      );
      await act(() =>
        page
          .getByLabelText("OAuth Client Secret (optional)")
          .fill(" secret bytes ")
      );
      await act(() =>
        page.getByRole("button", { exact: true, name: "Add" }).click()
      );
      expect(mocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          oauthClientId: expectedClientId,
          oauthClientSecret: " secret bytes ",
        }),
        expect.any(Object)
      );
    } finally {
      await cleanup();
    }
  }
);
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

test("OAuth callback errors display the safe actionable message", async () => {
  const message =
    "Could not complete connector authorization. Please try again.";
  mocks.search = new URLSearchParams({ error: message });
  const cleanup = await renderPage(false);
  try {
    await expect
      .element(page.getByText(message, { exact: true }))
      .toBeVisible();
    expect(mocks.router.replace).toHaveBeenCalledWith("/settings/connectors");
    await expect
      .poll(
        () =>
          document.querySelector<HTMLElement>("[data-sonner-toast]")?.dataset
            .mounted
      )
      .toBe("true");
    await takeSnapshot("mcp-callback-error");
  } finally {
    await cleanup();
  }
});

/* oxlint-disable typescript/promise-function-async -- mcp-settings.browser route: ; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */
test("invalid authorization links keep the dialog open and display an error", async () => {
  const cleanup = await renderPage(false, false, true);
  try {
    await act(() =>
      page
        .getByRole("button", { name: "Continue to Documentation server" })
        .click()
    );
    const [[, callbacks]] = mocks.mutate.mock.calls;
    // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return -- Invoke the success callback captured from the real mutation call; this fixture tests how the component handles both valid and invalid authorization URLs.
    await act(() => callbacks.onSuccess({ authorizationUrl: "not a URL" }));
    await expect
      .element(page.getByText("Invalid authorization URL", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { exact: true, name: "Cancel" }))
      .toBeEnabled();
    await expect
      .poll(
        () =>
          document.querySelector<HTMLElement>("[data-sonner-toast]")?.dataset
            .mounted
      )
      .toBe("true");
    await takeSnapshot("mcp-invalid-authorization-url");
  } finally {
    await cleanup();
  }
});
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable max-lines -- mcp-settings.browser keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */

for (const state of ["off", "enabled", "saving", "shared"] as const) {
  // oxlint-disable-next-line max-statements -- Keep each approval state, interaction, capture and cleanup together so the persisted setting is verified as one scenario.
  test(`connection approval setting is ${state}`, async () => {
    Object.assign(mocks, {
      approvalRequired: state !== "off",
      pendingAuthorization: state === "saving",
      sharedConnector: state === "shared",
    });
    const cleanup = await renderPage(true);
    try {
      const approval = page.getByRole("switch", { name: "Require approval" });
      await expect
        .element(approval)
        .toHaveAttribute("aria-checked", String(state !== "off"));
      if (state === "enabled" || state === "off") {
        await approval.click();
        expect(mocks.mutate).toHaveBeenCalledWith({
          id: "documentation",
          updates: { requireApproval: state === "off" },
        });
      } else {
        await expect.element(approval).toBeDisabled();
      }
      await takeSnapshot(`mcp-approval-${state}`);
    } finally {
      await cleanup();
    }
  });
}
