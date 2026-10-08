"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
/* oxlint-enable sort-imports */
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Fragment, useCallback, useEffect, useMemo } from "react";
/* oxlint-enable sort-imports */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ConnectorHeader } from "@/components/settings/connector-header";
/* oxlint-enable sort-imports */
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { McpCreateDialog } from "@/components/settings/mcp-create-dialog";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { SettingsPageContent } from "@/components/settings/settings-page";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { installedFeatures } from "@/features/installed";
/* oxlint-enable sort-imports */
import type { McpConnector } from "@/lib/db/schema";
import type { McpConnectorsDialog } from "@/lib/nuqs/mcp-search-params";
import { mcpConnectorsSettingsSearchParams } from "@/lib/nuqs/mcp-search-params";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable react/jsx-no-literals -- CustomConnectorRow renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */

/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.mcp.checkAuth.queryOptions({ id: connector.id }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...trpc.mcp.checkAuth.queryOptions({ id: connector.id }),
    staleTime: 30_000,
  });

  const { isLoading: isTestingConnection, data: connectionStatus } = useQuery({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.mcp.testConnection.queryOptions({ id: connector.id }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...trpc.mcp.testConnection.queryOptions({ id: connector.id }),
    retry: false,
    staleTime: 30_000,
  });

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading needsAuth from connectionStatus; preserve one receiver evaluation, skipped accesses and the existing false fallback.
  const needsOAuth = connectionStatus?.needsAuth ?? false;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from connectionStatus; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const isConnected = connectionStatus?.status === "connected";
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from connectionStatus; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading error from connectionStatus; preserve one receiver evaluation, skipped accesses and the existing "Unable to reach server" fallback.
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
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          isIncompatible ? (
            <Badge
              // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
              className="gap-1"
              variant="destructive"
            >
              <AlertTriangle
                // oxlint-disable-next-line react/forbid-component-props -- AlertTriangle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-3"
              />
              Error
            </Badge>
          ) : null
        }

        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          showOAuthButton ? (
            <Button
              disabled={isTestingConnection}
              onClick={onConnect}
              size="sm"
            >
              {
                // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                isTestingConnection ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2
                      // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="size-4 animate-spin"
                    />
                    Loading
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Connect
                    <ArrowUpRight
                      // oxlint-disable-next-line react/forbid-component-props -- ArrowUpRight accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="-mr-1 size-4"
                    />
                  </span>
                )
              }
            </Button>
          ) : null
        }

        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          showDetailsButton ? (
            <Button
              asChild
              disabled={isTestingConnection}
              size="sm"
              variant="outline"
            >
              <InternalLink href={href}>
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  isTestingConnection ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                        className="size-4 animate-spin"
                      />
                      Loading
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      {actionLabel}
                    </span>
                  )
                }
              </InternalLink>
            </Button>
          ) : null
        }
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More connector actions"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal
                // oxlint-disable-next-line react/forbid-component-props -- MoreHorizontal accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {
              /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading isAuthenticated from authStatus; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. */

              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              authStatus?.isAuthenticated ? (
                <>
                  <DropdownMenuItem
                    disabled={isDisconnecting}
                    onClick={onDisconnect}
                  >
                    Disconnect
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null
              /* oxlint-enable oxc/no-optional-chaining */
            }
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              needsOAuth ? (
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
              ) : null
            }
            <DropdownMenuItem
              // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-destructive focus:text-destructive"
              onClick={onUninstall}
            >
              <Trash2
                // oxlint-disable-next-line react/forbid-component-props -- Trash2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
              Uninstall
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- BuiltInConnectorRow renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */

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
      <Button asChild size="sm" variant="outline">
        <InternalLink href={href}>View</InternalLink>
      </Button>
    </div>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ConnectorsSettings); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ConnectorsSettings renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-enable react/no-multi-comp */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.mcp.list.queryOptions() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...trpc.mcp.list.queryOptions(),
    enabled: installedFeatures.has("mcp"),
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve { mutate: deleteConnector }'s awaited sequencing and rejected-Promise behavior. */
  const { mutate: deleteConnector } = useMutation(
    trpc.mcp.delete.mutationOptions({
      onError: (
        _err: unknown,
        _data,
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Return the original typed cache snapshot to queryClient.setQueryData; its deep readonly array is rejected by the cache receiver (TS2345).
        context: { readonly prev: typeof connectors } | undefined
      ): void => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading prev from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  /* oxlint-enable oxc/no-async-await */
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

  if (!installedFeatures.has("mcp")) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">MCP is not enabled</p>
        </div>
      </SettingsPageContent>
    );
  }
  if (isLoading) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
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
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
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
    <SettingsPageContent
      // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="gap-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Custom connectors</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Connect MCP servers you trust to extend your AI with tools.
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} size="sm">
          <Plus
            // oxlint-disable-next-line react/forbid-component-props -- Plus accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
          Add custom connector
        </Button>
      </div>

      <div className="flex flex-col">
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          customConnectors.length > 0 ? (
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
                    onConnect={(): void =>
                      handleOpenConnectDialog(connector.id)
                    }
                    onDisconnect={(): void =>
                      disconnectConnector({ id: connector.id })
                    }
                    onUninstall={(): void =>
                      deleteConnector({ id: connector.id })
                    }
                  />
                  {
                    // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                    index < customConnectors.length - 1 ? <Separator /> : null
                  }
                </Fragment>
              )
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="bg-muted mb-4 rounded-full p-3">
                <Radio
                  // oxlint-disable-next-line react/forbid-component-props -- Radio accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="text-muted-foreground size-6"
                />
              </div>
              <p className="text-sm font-medium">No custom connectors</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Add a custom MCP connector to access tools from your services.
              </p>
            </div>
          )
        }
      </div>

      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        globalConnectors.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Built-in connectors</p>
            <div className="divide-y">
              {globalConnectors.map(
                (
                  connector: Readonly<
                    Pick<McpConnector, "id" | "name" | "type" | "url">
                  >
                ) => (
                  <BuiltInConnectorRow
                    connector={connector}
                    key={connector.id}
                  />
                )
              )}
            </div>
          </div>
        ) : null
      }

      <McpCreateDialog onClose={handleDialogClose} open={createOpen} />

      <McpConnectDialog
        connector={connectConnector}
        onClose={handleConnectDialogClose}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
