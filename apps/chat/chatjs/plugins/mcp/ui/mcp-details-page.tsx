"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookText,
  ChevronLeft,
  FileText,
  Loader2,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";
import { ConnectorHeader } from "@/chatjs/plugins/mcp/ui/connector-header";
import { McpConnectDialog } from "@/chatjs/plugins/mcp/ui/mcp-connect-dialog";
import { SettingsPageContent } from "@/components/settings/settings-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/react";

const HTTP_STATUS_REGEX = /HTTP (?<status>\d{3})/u;

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

const DetailsSection = ({
  title,
  icon,
  items,
}: {
  readonly title: string;
  readonly icon: ReadonlyNativeSurface<React.ReactNode>;
  readonly items: readonly { readonly name: string; readonly key: string }[];
}): React.JSX.Element => {
  const count = items.length;

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">({count})</span>
      </div>
      <Separator className="my-3" />
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
  readonly isLoading: boolean;
  readonly showConnectButton: boolean;
  readonly onConnect: () => void;
  readonly isIncompatible: boolean;
  readonly connectionError?: string;
  readonly discoveryError: { readonly message: string } | null;
  readonly needsOAuth: boolean;
  readonly showDiscovery: boolean;
  readonly discovery: {
    readonly tools: readonly { readonly name: string }[];
    readonly resources: readonly {
      readonly name: string;
      readonly uri: string;
    }[];
    readonly prompts: readonly { readonly name: string }[];
  } | null;
}): React.JSX.Element | null => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
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
        <AlertCircle className="text-destructive size-6" />
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
        <AlertCircle className="text-destructive size-6" />
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
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-4">
          <DetailsSection
            icon={<Wrench className="size-4" />}
            items={discovery.tools.map((tool) => ({
              key: tool.name,
              name: tool.name,
            }))}
            title="Tools"
          />
          <DetailsSection
            icon={<FileText className="size-4" />}
            items={discovery.resources.map((resource) => ({
              key: resource.uri,
              name: resource.name,
            }))}
            title="Resources"
          />
          <DetailsSection
            icon={<BookText className="size-4" />}
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
        (candidateConnector: { readonly id: string }): boolean =>
          candidateConnector.id === connectorId
      ) ?? null,
    [connectors, connectorId]
  );

  const canEdit = connector?.userId !== null;

  const { mutate: toggleEnabled } = useMutation(
    trpc.mcp.toggleEnabled.mutationOptions({
      onError: (
        _err: unknown,
        _newData,
        context: { readonly prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update connector");
      },
      onMutate: async (newData) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(
          queryKey,
          (old: ReadonlyNativeSurface<typeof connectors>) => {
            if (!old) {
              return old;
            }
            return old.map(
              (
                candidateConnector: ReadonlyNativeSurface<
                  NonNullable<typeof connectors>[number]
                >
              ) => {
                if (candidateConnector.id === newData.id) {
                  return { ...candidateConnector, enabled: newData.enabled };
                }
                return candidateConnector;
              }
            );
          }
        );
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );
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
  const { mutate: deleteConnector } = useMutation(
    trpc.mcp.delete.mutationOptions({
      onError: (
        _err: unknown,
        _data,
        context: { readonly prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to uninstall connector");
      },
      onMutate: async (data) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(
          queryKey,
          (old: ReadonlyNativeSurface<typeof connectors>) => {
            if (!old) {
              return old;
            }
            return old.filter(
              (candidateConnector: { readonly id: string }): boolean =>
                candidateConnector.id !== data.id
            );
          }
        );
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
      <SettingsPageContent className="gap-4">
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
      <SettingsPageContent className="gap-4">
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
      <SettingsPageContent className="gap-4">
        <InternalLink
          href="/settings/connectors"
          className={buttonVariants({
            className: "w-fit",
            size: "sm",
            variant: "ghost",
          })}
        >
          <ChevronLeft className="size-4" />
          Back
        </InternalLink>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="text-destructive size-6" />
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
    <SettingsPageContent className="gap-4">
      <InternalLink
        href="/settings/connectors"
        className={buttonVariants({
          className: "w-fit",
          size: "sm",
          variant: "ghost",
        })}
      >
        <ChevronLeft className="size-4" />
        Back
      </InternalLink>

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
              className="text-muted-foreground text-xs"
              htmlFor="connector-enabled"
            >
              Enabled
            </Label>
          </div>

          {canEdit ? (
            <Button onClick={handleUninstall} size="sm" variant="destructive">
              <Trash2 className="size-4" />
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

      <Separator className="my-2" />

      <DiscoveryContent
        connectionError={connectionStatus?.error}
        discovery={discovery ?? null}
        discoveryError={discoveryError}
        isIncompatible={isIncompatible}
        isLoading={isLoadingDiscovery}
        needsOAuth={needsOAuth}
        onConnect={(): void => {
          setConnectOpen(true);
        }}
        showConnectButton={showConnectButton}
        showDiscovery={showDiscovery}
      />

      <McpConnectDialog
        connector={connector}
        onClose={(): void => {
          setConnectOpen(false);
        }}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
};
