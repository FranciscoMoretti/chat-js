"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  AlertCircle,
  BookText,
  ChevronLeft,
  FileText,
  Loader2,
  Trash2,
  Wrench,
} from "lucide-react";
/* oxlint-enable sort-imports */
import { useRouter, useSearchParams } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
/* oxlint-enable sort-imports */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ConnectorHeader } from "@/components/settings/connector-header";
/* oxlint-enable sort-imports */
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { SettingsPageContent } from "@/components/settings/settings-page";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { Label } from "@/components/ui/label";
/* oxlint-enable import/max-dependencies */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/react";

const HTTP_STATUS_REGEX = /HTTP (?<status>\d{3})/u;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const formatMcpError = (message: string): string => {
  const httpMatch = HTTP_STATUS_REGEX.exec(message);
  if (httpMatch) {
    const [, status] = httpMatch;
    if (status === "502") {
      return "MCP server is temporarily unavailable (502 Bad Gateway)";
    }
    if (status === "503") {
      return "MCP server is temporarily unavailable (503 Service Unavailable)";
    }
    if (status === "504") {
      return "MCP server timed out (504 Gateway Timeout)";
    }
    if (status === "500") {
      return "MCP server encountered an internal error (500)";
    }
    if (status === "401" || status === "403") {
      return "Authentication failed. Try reconnecting.";
    }
    return `MCP server returned HTTP ${status}`;
  }
  if (message.length > 200) {
    return `${message.slice(0, 200)}...`;
  }
  return message;
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const DetailsSection = ({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; key: string }[];
}) => {
  const count = items.length;

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">({count})</span>
      </div>
      <Separator
        // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
        className="my-3"
      />
      {count === 0 ? (
        <p className="text-muted-foreground text-xs italic">None available</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(({ name, key }) => (
            <span
              className="bg-muted rounded-md px-2 py-1 font-mono text-xs"
              key={key}
              title={name}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react-perf/jsx-no-new-array-as-prop -- This prop derives its entries from the current render; memoization would add an unproven identity contract. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const DiscoveryContent = ({
  isLoading,
  showConnectButton,
  onConnect,
  isIncompatible,
  connectionError,
  discoveryError,
  needsOAuth,
  showDiscovery,
  discovery,
}: {
  isLoading: boolean;
  showConnectButton: boolean;
  onConnect: () => void;
  isIncompatible: boolean;
  connectionError?: string;
  discoveryError: { message: string } | null;
  needsOAuth: boolean;
  showDiscovery: boolean;
  discovery: {
    tools: { name: string }[];
    resources: { name: string; uri: string }[];
    prompts: { name: string }[];
  } | null;
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground size-6 animate-spin"
        />
      </div>
    );
  }

  if (showConnectButton) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm font-medium">Authorization required</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          Connect this connector to access its tools and resources.
        </p>
        <Button onClick={onConnect}>Connect</Button>
      </div>
    );
  }

  if (isIncompatible) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <AlertCircle
          // oxlint-disable-next-line react/forbid-component-props -- AlertCircle accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-destructive size-6"
        />
        <p className="text-sm font-medium">Incompatible server</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {connectionError ??
            "This server requires pre-configured OAuth credentials."}
        </p>
      </div>
    );
  }

  if (discoveryError && !needsOAuth) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <AlertCircle
          // oxlint-disable-next-line react/forbid-component-props -- AlertCircle accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-destructive size-6"
        />
        <p className="text-muted-foreground text-sm">
          Failed to connect to MCP server
        </p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {formatMcpError(discoveryError.message)}
        </p>
      </div>
    );
  }

  if (showDiscovery && discovery) {
    return (
      <ScrollArea
        // oxlint-disable-next-line react/forbid-component-props -- ScrollArea accepts className in its styling contract; preserve this caller's layout and appearance.
        className="max-h-[60vh]"
      >
        <div className="space-y-4">
          <DetailsSection
            icon={
              <Wrench
                // oxlint-disable-next-line react/forbid-component-props -- Wrench accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
            }
            items={discovery.tools.map((tool) => ({
              key: tool.name,
              name: tool.name,
            }))}
            title="Tools"
          />
          <DetailsSection
            icon={
              <FileText
                // oxlint-disable-next-line react/forbid-component-props -- FileText accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
            }
            items={discovery.resources.map((resource) => ({
              key: resource.uri,
              name: resource.name,
            }))}
            title="Resources"
          />
          <DetailsSection
            icon={
              <BookText
                // oxlint-disable-next-line react/forbid-component-props -- BookText accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
            }
            items={discovery.prompts.map((prompt) => ({
              key: prompt.name,
              name: prompt.name,
            }))}
            title="Prompts"
          />
        </div>
      </ScrollArea>
    );
  }

  return null;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react-perf/jsx-no-new-array-as-prop */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const McpDetailsPage = ({
  connectorId,
}: {
  readonly connectorId: string;
}): React.JSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connectOpen, setConnectOpen] = useState(false);

  const queryKey = trpc.mcp.list.queryKey();

  const {
    data: connectors,
    isLoading: isLoadingConnectors,
    error: connectorsError,
    refetch: refetchConnectors,
  } = useQuery(trpc.mcp.list.queryOptions());

  const connector = useMemo(
    () =>
      connectors?.find(
        (candidateConnector): boolean => candidateConnector.id === connectorId
      ) ?? null,
    [connectors, connectorId]
  );

  const canEdit = connector?.userId !== null;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve { mutate: toggleEnabled }'s awaited sequencing and rejected-Promise behavior. */
  const { mutate: toggleEnabled } = useMutation(
    trpc.mcp.toggleEnabled.mutationOptions({
      onError: (
        _err,
        _newData,
        context: { prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update connector");
      },
      onMutate: async (newData) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof connectors) => {
          if (!old) {
            return old;
          }
          return old.map((candidateConnector) =>
            candidateConnector.id === newData.id
              ? { ...candidateConnector, enabled: newData.enabled }
              : candidateConnector
          );
        });
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve { mutate: updateApproval, isPending: isUpdatingApproval }'s awaited sequencing and rejected-Promise behavior. */
  const { mutate: updateApproval, isPending: isUpdatingApproval } = useMutation(
    trpc.mcp.update.mutationOptions({
      onError: (): void => {
        toast.error("Failed to update approval setting");
      },
      onSuccess: async (): Promise<void> => {
        await queryClient.invalidateQueries({ queryKey });
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve { mutate: deleteConnector }'s awaited sequencing and rejected-Promise behavior. */
  const { mutate: deleteConnector } = useMutation(
    trpc.mcp.delete.mutationOptions({
      onError: (
        _err,
        _data,
        context: { prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to uninstall connector");
      },
      onMutate: async (data) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof connectors) => {
          if (!old) {
            return old;
          }
          return old.filter(
            (candidateConnector): boolean => candidateConnector.id !== data.id
          );
        });
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
      onSuccess: (): void => {
        void queryClient.invalidateQueries({
          queryKey: trpc.mcp.listConnected.queryKey(),
        });
        toast.success("Connector uninstalled");
        router.push("/settings/connectors");
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  const {
    data: discovery,
    isLoading: isLoadingDiscovery,
    error: discoveryError,
    refetch: refetchDiscovery,
  } = useQuery({
    ...trpc.mcp.discover.queryOptions({ id: connectorId }),
    enabled: connector !== null,
    retry: false,
  });

  const { data: connectionStatus } = useQuery({
    ...trpc.mcp.testConnection.queryOptions({ id: connectorId }),
    enabled: connector !== null,
    retry: false,
    staleTime: 30_000,
  });

  const isIncompatible = connectionStatus?.status === "incompatible";

  const needsOAuth =
    discoveryError?.data?.code === "UNAUTHORIZED" &&
    discoveryError.message.includes("OAuth authorization");

  useEffect((): void => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");

    if (typeof connected === "string" && connected !== "") {
      toast.success("Authorization successful");
    }
    if (typeof err === "string" && err !== "") {
      toast.error(err);
    }

    if (
      (typeof connected === "string" && connected !== "") ||
      (typeof err === "string" && err !== "")
    ) {
      router.replace(`/settings/connectors/${connectorId}`);
      void queryClient.invalidateQueries({
        queryKey: trpc.mcp.checkAuth.queryKey({ id: connectorId }),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.mcp.discover.queryKey({ id: connectorId }),
      });
      void refetchDiscovery();
    }
  }, [
    connectorId,
    queryClient,
    refetchDiscovery,
    router,
    searchParams,
    trpc.mcp.checkAuth,
    trpc.mcp.discover,
  ]);

  const handleToggleEnabled = useCallback(
    (enabled: boolean): void => {
      if (!connector) {
        return;
      }
      toggleEnabled({
        enabled,
        id: connector.id,
      });
    },
    [connector, toggleEnabled]
  );

  const handleApprovalChange = useCallback(
    (requireApproval: boolean): void => {
      if (!connector || !canEdit) {
        return;
      }
      updateApproval({ id: connector.id, updates: { requireApproval } });
    },
    [canEdit, connector, updateApproval]
  );

  const handleUninstall = useCallback((): void => {
    if (!connector) {
      return;
    }
    deleteConnector({ id: connector.id });
  }, [connector, deleteConnector]);

  if (isLoadingConnectors) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div className="animate-pulse space-y-3">
          {[1, 2].map((placeholderIndex) => (
            <div
              className="bg-muted/50 h-20 rounded-lg"
              key={placeholderIndex}
            />
          ))}
        </div>
      </SettingsPageContent>
    );
  }

  if (connectorsError && !connectors) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <p className="text-sm font-medium">Could not load connectors</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {connectorsError.message}
          </p>
          {}
          <Button
            onClick={(): void => {
              void refetchConnectors();
            }}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </SettingsPageContent>
    );
  }

  if (!connector) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <Button
          asChild
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
          className="w-fit"
          size="sm"
          variant="ghost"
        >
          <InternalLink href="/settings/connectors">
            <ChevronLeft
              // oxlint-disable-next-line react/forbid-component-props -- ChevronLeft accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
            Back
          </InternalLink>
        </Button>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle
            // oxlint-disable-next-line react/forbid-component-props -- AlertCircle accepts className in its styling contract; preserve this caller's layout and appearance.
            className="text-destructive size-6"
          />
          <p className="mt-2 text-sm font-medium">Connector not found</p>
          <p className="text-muted-foreground mt-1 text-xs">
            It may have been deleted or you don’t have access.
          </p>
        </div>
      </SettingsPageContent>
    );
  }

  const showConnectButton = needsOAuth && !isIncompatible;
  const showDiscovery = Boolean(discovery) && !needsOAuth && !isIncompatible;

  return (
    <SettingsPageContent
      // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="gap-4"
    >
      <Button
        asChild
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-fit"
        size="sm"
        variant="ghost"
      >
        <InternalLink href="/settings/connectors">
          <ChevronLeft
            // oxlint-disable-next-line react/forbid-component-props -- ChevronLeft accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
          Back
        </InternalLink>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ConnectorHeader
          isCustom={connector.userId !== null}
          name={connector.name}
          type={connector.type}
          url={connector.url}
        />

        <div className="flex shrink-0 items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              disabled={!canEdit}
              id="connector-enabled"
              onCheckedChange={handleToggleEnabled}
            />
            <Label
              // oxlint-disable-next-line react/forbid-component-props -- Label accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-muted-foreground text-xs"
              htmlFor="connector-enabled"
            >
              Enabled
            </Label>
          </div>

          {canEdit ? (
            <Button onClick={handleUninstall} size="sm" variant="destructive">
              <Trash2
                // oxlint-disable-next-line react/forbid-component-props -- Trash2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
              Uninstall
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="connector-require-approval">Require approval</Label>
          <p
            className="text-muted-foreground text-sm"
            id="connector-approval-description"
          >
            Ask before running tools from this connection.
          </p>
        </div>
        <Switch
          aria-describedby="connector-approval-description"
          checked={connector.requireApproval}
          disabled={!canEdit || isUpdatingApproval}
          id="connector-require-approval"
          onCheckedChange={handleApprovalChange}
        />
      </div>

      <Separator
        // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
        className="my-2"
      />

      <DiscoveryContent
        connectionError={connectionStatus?.error}
        discovery={discovery ?? null}
        discoveryError={discoveryError}
        isIncompatible={isIncompatible}
        isLoading={isLoadingDiscovery}
        needsOAuth={needsOAuth}
        onConnect={(): void => setConnectOpen(true)}
        showConnectButton={showConnectButton}
        showDiscovery={showDiscovery}
      />

      <McpConnectDialog
        connector={connector}
        onClose={(): void => setConnectOpen(false)}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-enable unicorn/no-null */

/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
