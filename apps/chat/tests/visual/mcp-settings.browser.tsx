import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { McpCreateDialog } from "@/components/settings/mcp-create-dialog";
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";

import "./sandbox.css";

const mocks = vi.hoisted(() => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.hoisted must initialize the mock factory before module imports.
  const query = (name: string) => ({
    queryKey: () => [name],
    queryOptions: () => ({ queryKey: [name] }),
  });
  const mutation = { mutationOptions: () => ({}) };
  return {
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
    },
    mutate: vi.fn(),
    needsOAuth: false,
    pendingAuthorization: false,
    queryClient: { invalidateQueries: vi.fn() },
    refetch: vi.fn(),
    router: { push: vi.fn(), replace: vi.fn() },
    search: new URLSearchParams(),
  };
});
afterEach(() => {
  mocks.listError = false;
  mocks.cachedData = false;
  mocks.needsOAuth = false;
  mocks.pendingAuthorization = false;
  vi.clearAllMocks();
  mocks.search = new URLSearchParams();
});
const connector = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  enabled: true,
  id: "documentation",
  name: "Documentation server",
  nameId: "documentation",
  oauthClientId: null,
  oauthClientSecret: null,
  type: "sse" as const,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  url: "https://docs.example.test/mcp",
  userId: "fixture-owner",
};
vi.mock("@/features/installed", () => ({
  installedFeatures: new Set(["mcp"]),
}));
vi.mock("@/trpc/react", () => ({ useTRPC: () => ({ mcp: mocks.mcp }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.search,
}));
vi.mock("@/lib/nuqs/mcp-search-params", () => ({
  mcpConnectorsSettingsSearchParams: {},
}));
vi.mock("nuqs", () => ({
  useQueryStates: () => [{ connectorId: null, dialog: null }, vi.fn()],
}));
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
        connector,
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
        {content}
      </SettingsPage>
    )
  );
  return async () => {
    await act(() => root.unmount());
    container.remove();
  };
};

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
      callbacks.onSuccess({
        authorizationUrl: "https://authorization.example.test",
      })
    );
    expect(window.location.hostname).not.toBe("authorization.example.test");
  } finally {
    await cleanup();
  }
});
