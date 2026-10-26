"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import React, { Fragment, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";
import { ConnectorHeader } from "@/plugins/mcp/ui/connector-header";
import { McpConnectDialog } from "@/plugins/mcp/ui/mcp-connect-dialog";
import { McpCreateDialog } from "@/plugins/mcp/ui/mcp-create-dialog";
import { SettingsPageContent } from "@/components/settings/settings-page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { McpConnector } from "@/plugins/mcp/db/mcp-schema";
import type { McpConnectorsDialog } from "@/plugins/mcp/search/mcp-search-params";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { Separator } from "@/components/ui/separator";
import { installedPlugins } from "@/composition/generated/installed";
import { mcpConnectorsSettingsSearchParams } from "@/plugins/mcp/search/mcp-search-params";
import { useTRPC } from "@/trpc/react";

const CustomConnectorRow = ({
  connector,
  onConnect,
  onUninstall,
  onDisconnect,
  isDisconnecting,
}: {
  readonly connector: Readonly<
    Pick<McpConnector, "id" | "name" | "type" | "url">
  >;
  readonly onConnect: () => void;
  readonly onUninstall: () => void;
  readonly onDisconnect: () => void;
  readonly isDisconnecting: boolean;
}): React.JSX.Element => {
  const trpc = useTRPC();

  const { data: authStatus } = useQuery({
    ...trpc.mcp.checkAuth.queryOptions({ id: connector.id }),
    staleTime: 30_000,
  });

  const { isLoading: isTestingConnection, data: connectionStatus } = useQuery({
    ...trpc.mcp.testConnection.queryOptions({ id: connector.id }),
    retry: false,
    staleTime: 30_000,
  });

  const needsOAuth = connectionStatus?.needsAuth ?? false;
  const isConnected = connectionStatus?.status === "connected";
  const isIncompatible = connectionStatus?.status === "incompatible";

  const statusText = ((): string => {
    if (isTestingConnection) {
      return "Checking connection…";
    }
    if (isIncompatible) {
      return "Incompatible server";
    }
    if (needsOAuth) {
      return "Authorization required";
    }
    if (isConnected) {
      return "Connected";
    }
    return connectionStatus?.error ?? "Unable to reach server";
  })();

  const actionLabel = ((): string => {
    if (isTestingConnection) {
      return "Loading";
    }
    if (needsOAuth) {
      return "Connect";
    }
    return "Configure";
  })();

  const href: `/settings/connectors/${string}` = `/settings/connectors/${connector.id}`;

  const showOAuthButton = needsOAuth && !isIncompatible;
  const showDetailsButton = !(needsOAuth || isIncompatible);

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left">
        <ConnectorHeader
          isCustom
          name={connector.name}
          statusText={statusText}
          type={connector.type}
          url={connector.url}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isIncompatible ? (
          <Badge className="gap-1" variant="destructive">
            <AlertTriangle className="size-3" />
            Error
          </Badge>
        ) : null}

        {showOAuthButton ? (
          <Button disabled={isTestingConnection} onClick={onConnect} size="sm">
            {isTestingConnection ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Connect
                <ArrowUpRight className="-mr-1 size-4" />
              </span>
            )}
          </Button>
        ) : null}

        {showDetailsButton ? (
          <InternalLink
            href={href}
            className={buttonVariants({ size: "sm", variant: "outline" })}
            aria-disabled={isTestingConnection}
            tabIndex={isTestingConnection ? -1 : undefined}
            onClick={(event) => {
              if (isTestingConnection) {
                event.preventDefault();
              }
            }}
          >
            {isTestingConnection ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {actionLabel}
              </span>
            )}
          </InternalLink>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="More connector actions"
                size="icon"
                variant="ghost"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {authStatus?.isAuthenticated === true ? (
                <>
                  <DropdownMenuItem
                    disabled={isDisconnecting}
                    onClick={onDisconnect}
                  >
                    Disconnect
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {needsOAuth ? (
                <>
                  <DropdownMenuItem
                    onClick={(
                      event: Readonly<Pick<Event, "preventDefault">>
                    ): void => {
                      event.preventDefault();
                      onConnect();
                    }}
                  >
                    Connect
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem variant="destructive" onClick={onUninstall}>
                <Trash2 className="size-4" />
                Uninstall
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const BuiltInConnectorRow = ({
  connector,
}: {
  readonly connector: {
    readonly id: string;
    readonly name: string;
    readonly type: "http" | "sse";
    readonly url: string;
  };
}): React.JSX.Element => {
  const href: `/settings/connectors/${string}` = `/settings/connectors/${connector.id}`;
  return (
    <div className="flex w-full items-center gap-3 py-3 text-left">
      <ConnectorHeader
        isCustom={false}
        name={connector.name}
        type={connector.type}
        url={connector.url}
      />
      <InternalLink
        href={href}
        className={buttonVariants({ size: "sm", variant: "outline" })}
      >
        View
      </InternalLink>
    </div>
  );
};

export const ConnectorsSettings = (): React.JSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect((): void => {
    const callbackError = searchParams.get("error");
    if (typeof callbackError === "string" && callbackError !== "") {
      toast.error(callbackError);
      router.replace("/settings/connectors");
    }
  }, [router, searchParams]);

  const [qs, setQs] = useQueryStates(mcpConnectorsSettingsSearchParams, {
    history: "replace",
    shallow: true,
  });

  const {
    data: connectors,
    isLoading,
    error,
    refetch: refetchConnectors,
  } = useQuery({
    ...trpc.mcp.list.queryOptions(),
    enabled: installedPlugins.has("mcp"),
  });

  const createOpen = qs.dialog === "config";
  const connectOpen = qs.dialog === "connect" && Boolean(qs.connectorId);

  const connectConnector = useMemo(() => {
    if (
      !(
        connectOpen &&
        typeof qs.connectorId === "string" &&
        qs.connectorId !== "" &&
        connectors
      )
    ) {
      return null;
    }
    return (
      connectors.find(
        (connector: { readonly id: string }): boolean =>
          connector.id === qs.connectorId
      ) ?? null
    );
  }, [connectOpen, qs.connectorId, connectors]);

  const queryKey = trpc.mcp.list.queryKey();

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
              (connector: { readonly id: string }): boolean =>
                connector.id !== data.id
            );
          }
        );
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({
          queryKey: trpc.mcp.listConnected.queryKey(),
        });
      },
      onSuccess: (): void => {
        toast.success("Connector uninstalled");
      },
    })
  );
  const { mutate: disconnectConnector, isPending: isDisconnecting } =
    useMutation(
      trpc.mcp.disconnect.mutationOptions({
        onError: (err: { readonly message: string }): void => {
          toast.error(err.message || "Failed to disconnect");
        },
        onSettled: (_data: unknown, _err: unknown, vars): void => {
          void queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.listConnected.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.checkAuth.queryKey({ id: vars.id }),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.discover.queryKey({ id: vars.id }),
          });
        },
        onSuccess: (_data: Readonly<{ success: boolean }>, vars): void => {
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.testConnection.queryKey({ id: vars.id }),
          });
          toast.success("Disconnected");
        },
      })
    );

  const setDialogState = useCallback(
    ({
      dialog,
      connectorId,
    }: {
      readonly dialog: McpConnectorsDialog | null;
      readonly connectorId?: string | null;
    }): void => {
      void setQs({
        connectorId: connectorId ?? null,
        dialog,
      });
    },
    [setQs]
  );

  const handleOpenCreateDialog = useCallback((): void => {
    setDialogState({ dialog: "config" });
  }, [setDialogState]);

  const handleDialogClose = (): void => {
    setDialogState({ dialog: null });
  };

  const handleOpenConnectDialog = useCallback(
    (connectorId: string): void => {
      setDialogState({
        connectorId,
        dialog: "connect",
      });
    },
    [setDialogState]
  );

  const handleConnectDialogClose = useCallback((): void => {
    setDialogState({ dialog: null });
  }, [setDialogState]);

  if (!installedPlugins.has("mcp")) {
    return (
      <SettingsPageContent className="gap-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">MCP is not enabled</p>
        </div>
      </SettingsPageContent>
    );
  }
  if (isLoading) {
    return (
      <SettingsPageContent className="gap-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((placeholderIndex) => (
            <div
              className="bg-muted/50 h-20 rounded-lg"
              key={placeholderIndex}
            />
          ))}
        </div>
      </SettingsPageContent>
    );
  }

  if (error && !connectors) {
    return (
      <SettingsPageContent className="gap-4">
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <p className="text-sm font-medium">Could not load connectors</p>
          <p className="text-muted-foreground mt-1 text-xs">{error.message}</p>
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

  const customConnectors = (connectors ?? []).filter(
    (connector: { readonly userId: string | null }): boolean =>
      connector.userId !== null
  );
  const globalConnectors = (connectors ?? []).filter(
    (connector: { readonly userId: string | null }): boolean =>
      connector.userId === null
  );

  return (
    <SettingsPageContent className="gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Custom connectors</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Connect MCP servers you trust to extend your AI with tools.
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} size="sm">
          <Plus className="size-4" />
          Add custom connector
        </Button>
      </div>

      <div className="flex flex-col">
        {customConnectors.length > 0 ? (
          customConnectors.map(
            (
              connector: Readonly<
                Pick<McpConnector, "id" | "name" | "type" | "url">
              >,
              index
            ) => (
              <Fragment key={connector.id}>
                <CustomConnectorRow
                  connector={connector}
                  isDisconnecting={isDisconnecting}
                  onConnect={(): void => {
                    handleOpenConnectDialog(connector.id);
                  }}
                  onDisconnect={(): void => {
                    disconnectConnector({ id: connector.id });
                  }}
                  onUninstall={(): void => {
                    deleteConnector({ id: connector.id });
                  }}
                />
                {index < customConnectors.length - 1 ? <Separator /> : null}
              </Fragment>
            )
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-muted mb-4 rounded-full p-3">
              <Radio className="text-muted-foreground size-6" />
            </div>
            <p className="text-sm font-medium">No custom connectors</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Add a custom MCP connector to access tools from your services.
            </p>
          </div>
        )}
      </div>

      {globalConnectors.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Built-in connectors</p>
          <div className="divide-y">
            {globalConnectors.map(
              (
                connector: Readonly<
                  Pick<McpConnector, "id" | "name" | "type" | "url">
                >
              ) => (
                <BuiltInConnectorRow connector={connector} key={connector.id} />
              )
            )}
          </div>
        </div>
      ) : null}

      <McpCreateDialog onClose={handleDialogClose} open={createOpen} />

      <McpConnectDialog
        connector={connectConnector}
        onClose={handleConnectDialogClose}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
};
