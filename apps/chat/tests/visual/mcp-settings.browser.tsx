import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";

import "./sandbox.css";

const mocks = vi.hoisted(() => {
  const query = (name: string) => ({
    queryKey: () => [name],
    queryOptions: () => ({ queryKey: [name] }),
  });
  const mutation = { mutationOptions: () => ({}) };
  return {
    mcp: {
      authorize: mutation,
      checkAuth: query("checkAuth"),
      create: mutation,
      delete: mutation,
      disconnect: mutation,
      discover: query("discover"),
      list: query("list"),
      testConnection: query("testConnection"),
      toggleEnabled: mutation,
    },
    listError: false,
    mutate: vi.fn(),
    queryClient: { invalidateQueries: vi.fn() },
    refetch: vi.fn(),
    router: { push: vi.fn(), replace: vi.fn() },
    search: new URLSearchParams(),
  };
});
const connector = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  enabled: true,
  id: "documentation",
  name: "Documentation server",
  nameId: "documentation",
  oauthClientId: null,
  oauthClientSecret: null,
  type: "sse",
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
  useMutation: () => ({ isPending: false, mutate: mocks.mutate }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const responses: Record<string, unknown> = {
      checkAuth: { isAuthenticated: false },
      discover: {
        prompts: [{ name: "summarize" }],
        resources: [{ name: "Documentation" }],
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
    return {
      data: responses[queryKey[0]],
      error:
        queryKey[0] === "list" && mocks.listError
          ? { message: "Missing credentials for mcp: MCP_ENCRYPTION_KEY" }
          : null,
      isLoading: false,
      refetch: mocks.refetch,
    };
  },
  useQueryClient: () => mocks.queryClient,
}));

const renderPage = async (details: boolean) => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("div");
  container.className = "flex h-[850px] w-[900px] flex-col p-8";
  document.body.append(container);
  const root = createRoot(container);
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
        {details ? (
          <McpDetailsPage connectorId="documentation" />
        ) : (
          <ConnectorsSettings />
        )}
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
      .element(page.getByRole("link", { name: "View", exact: true }))
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
