import { renderRoot, unmountRoot } from "./primitive-mount";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ConnectorsSettings } from "@/plugins/mcp/ui/connectors-settings";
import { McpConnectDialog } from "@/plugins/mcp/ui/mcp-connect-dialog";
import { McpCreateDialog } from "@/plugins/mcp/ui/mcp-create-dialog";
import { McpDetailsPage } from "@/plugins/mcp/ui/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";

import "./sandbox.css";

const mocks = vi.hoisted(() => {
  const queries = Object.fromEntries(
    ["checkAuth", "discover", "list", "listConnected", "testConnection"].map(
      (
        name
      ): [
        string,
        {
          queryKey: () => string[];
          queryOptions: () => { queryKey: string[] };
        },
      ] => [
        name,
        {
          queryKey: () => [name],
          queryOptions: () => ({ queryKey: [name] }),
        },
      ]
    )
  );
  const mutation = { mutationOptions: () => ({}) };
  return {
    approvalRequired: false,
    cachedData: false,
    handleClose: vi.fn<() => void>(),
    listError: false,
    mcp: {
      ...queries,
      authorize: mutation,
      create: mutation,
      delete: mutation,
      disconnect: mutation,
      toggleEnabled: mutation,
      update: mutation,
    },
    mutate: vi.fn<
      (
        _input: unknown,
        callbacks?: {
          onSuccess: (result: { authorizationUrl: string }) => void;
        }
      ) => void
    >(),
    needsOAuth: false,
    pendingAuthorization: false,
    queryClient: { invalidateQueries: vi.fn() },
    refetch: vi.fn(),
    router: { push: vi.fn(), replace: vi.fn() },
    search: new URLSearchParams(),
    sharedConnector: false,
  };
});

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
vi.mock("@/composition/generated/installed", () => ({
  installedPlugins: new Set(["mcp"]),
}));

vi.mock("@/trpc/react", () => ({ useTRPC: () => ({ mcp: mocks.mcp }) }));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.search,
}));
vi.mock("@/plugins/mcp/search/mcp-search-params", () => ({
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

  await renderRoot(
    root,
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
  );
  return async (): Promise<void> => {
    await unmountRoot(root);
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
    await Promise.all(
      ["search_docs", "read_page", "Documentation", "summarize"].map(
        async (name) => {
          await expect
            .element(page.getByText(name, { exact: true }))
            .toBeVisible();
        }
      )
    );
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
    await act(async () => {
      await page.getByRole("button", { name: "Advanced settings" }).click();
    });
    await expect
      .element(page.getByText("Transport Type", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText("OAuth Client Secret (optional)"))
      .toBeVisible();
    await act(async () => {
      await page.getByPlaceholder("Name", { exact: true }).fill("   ");
    });
    await act(async () => {
      await page
        .getByPlaceholder("Remote MCP server URL")
        .fill("https://docs.example.test/mcp");
    });
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Add" }).click();
    });
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
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Cancel" }).click();
    });
    expect(mocks.handleClose).toHaveBeenCalledOnce();
  } finally {
    await cleanup();
  }
});

test("dismissed OAuth ignores a late authorization result", async () => {
  const cleanup = await renderPage(false, false, true);
  try {
    await act(async () => {
      await page
        .getByRole("button", { name: "Continue to Documentation server" })
        .click();
    });
    const [[, callbacks]] = mocks.mutate.mock.calls;
    if (callbacks === undefined) {
      throw new Error("Missing authorization callbacks");
    }
    await act(async () => {
      await page.getByRole("button", { exact: true, name: "Cancel" }).click();
    });
    // Select act's completion overload for this synchronous, undefined-returning callback.
    await act<undefined>((): undefined => {
      callbacks.onSuccess({
        authorizationUrl: "https://authorization.example.test",
      });
    });
    expect(globalThis.location.hostname).not.toBe("authorization.example.test");
  } finally {
    await cleanup();
  }
});

test.each([
  { clientId: "   ", expectedClientId: undefined },
  { clientId: " client id ", expectedClientId: " client id " },
])(
  "optional credentials preserve opaque bytes ($clientId)",
  async ({ clientId, expectedClientId }) => {
    const cleanup = await renderPage(false, true);
    try {
      await act(async () => {
        await page.getByRole("button", { name: "Advanced settings" }).click();
      });
      await act(async () => {
        await page.getByLabelText("Name", { exact: true }).fill("Server");
      });
      await act(async () => {
        await page
          .getByLabelText("URL", { exact: true })
          .fill("https://mcp.example.test");
      });
      await act(async () => {
        await page.getByLabelText("OAuth Client ID (optional)").fill(clientId);
      });
      await act(async () => {
        await page
          .getByLabelText("OAuth Client Secret (optional)")
          .fill(" secret bytes ");
      });
      await act(async () => {
        await page.getByRole("button", { exact: true, name: "Add" }).click();
      });
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

test("invalid authorization links keep the dialog open and display an error", async () => {
  const cleanup = await renderPage(false, false, true);
  try {
    await act(async () => {
      await page
        .getByRole("button", { name: "Continue to Documentation server" })
        .click();
    });
    const [[, callbacks]] = mocks.mutate.mock.calls;
    if (callbacks === undefined) {
      throw new Error("Missing authorization callbacks");
    }

    await act<undefined>((): undefined => {
      callbacks.onSuccess({ authorizationUrl: "not a URL" });
    });
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

for (const state of ["off", "enabled", "saving", "shared"] as const) {
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

// A synchronous onValid failure becomes a rejected RHF handleSubmit promise.
test("custom connector submission reports RHF rejection and retains entered fields", async () => {
  mocks.mutate.mockImplementationOnce(() => {
    throw new Error("Connector submission failed");
  });
  const cleanup = await renderPage(false, true);
  try {
    await page.getByLabelText("Name", { exact: true }).fill("Server");
    await page
      .getByLabelText("URL", { exact: true })
      .fill("https://mcp.example.test");
    await page.getByRole("button", { exact: true, name: "Add" }).click();
    await expect
      .element(page.getByText("Connector submission failed", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText("Name", { exact: true }))
      .toHaveValue("Server");
    expect(mocks.handleClose).not.toHaveBeenCalled();
    await takeSnapshot("mcp-create-submission-failure");
  } finally {
    await cleanup();
  }
});
