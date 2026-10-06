"use client";

import { useMutation } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";
/* oxlint-enable sort-imports */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Favicon } from "@/components/favicon";
/* oxlint-enable sort-imports */
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { McpConnector } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpConnectDialog); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- McpConnectDialog renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const McpConnectDialog = ({
  open,
  onClose,
  connector,
}: {
  open: boolean;
  onClose: () => void;
  connector: McpConnector | null;
}): React.JSX.Element => {
  const trpc = useTRPC();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const attempt = useRef(0);
  useEffect(() => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    if (!open || !connector?.id) {
      attempt.current += 1;
    }
    return (): void => {
      attempt.current += 1;
    };
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  }, [open, connector?.id]);
  const handleClose = useCallback((): void => {
    attempt.current += 1;
    setIsRedirecting(false);
    onClose();
  }, [onClose]);

  const faviconUrl = useMemo((): string => {
    if (!connector) {
      return "";
    }
    if (connector.type === "http") {
      return getGoogleFaviconUrl(connector.url);
    }
    return "";
  }, [connector]);

  const { mutate: authorize, isPending } = useMutation(
    trpc.mcp.authorize.mutationOptions()
  );

  const handleContinue = useCallback((): void => {
    if (!connector) {
      return;
    }
    attempt.current += 1;
    const currentAttempt = attempt.current;
    authorize(
      { id: connector.id },
      {
        onError: (err): void => {
          if (attempt.current === currentAttempt) {
            toast.error(err.message || "Failed to start connection");
          }
        },
        onSuccess: ({ authorizationUrl }): void => {
          if (attempt.current !== currentAttempt) {
            return;
          }
          let url: URL;
          try {
            url = new URL(authorizationUrl);
          } catch {
            toast.error("Invalid authorization URL");
            return;
          }
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            toast.error("Invalid authorization URL");
            return;
          }
          setIsRedirecting(true);
          globalThis.location.href = url.href;
        },
      }
    );
  }, [authorize, connector]);

  return (
    <Dialog
      onOpenChange={(isOpen): void => {
        if (!isOpen) {
          handleClose();
        }
      }}
      open={open}
    >
      <DialogContent
        // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="sm:max-w-md"
      >
        <DialogHeader
          // oxlint-disable-next-line react/forbid-component-props -- DialogHeader accepts className in its styling contract; preserve this caller's layout and appearance.
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
              {
                // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                faviconUrl ? (
                  <>
                    <Favicon
                      // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="size-5 rounded-sm"
                      url={faviconUrl}
                    />
                    <Globe
                      // oxlint-disable-next-line react/forbid-component-props -- Globe accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="text-muted-foreground hidden size-5"
                    />
                  </>
                ) : (
                  <Globe
                    // oxlint-disable-next-line react/forbid-component-props -- Globe accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="text-muted-foreground size-5"
                  />
                )
              }
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <DialogTitle /* oxlint-disable oxc/no-optional-chaining -- Keep this JSX structure; narrower inline directives make pinned Oxfmt add or restructure JSX text/expression nodes. Keep the existing nullish guard when reading name from connector; preserve one receiver evaluation, skipped accesses and the existing "connector" fallback. */
                // oxlint-disable-next-line react/forbid-component-props -- DialogTitle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="truncate"
              >
                Connect {connector?.name ?? "connector"}
              </DialogTitle /* oxlint-enable oxc/no-optional-chaining */>
              <DialogDescription /* oxlint-disable oxc/no-optional-chaining -- Keep this JSX structure; narrower inline directives make pinned Oxfmt add or restructure JSX text/expression nodes. Keep the existing nullish guard when reading url from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. */
                // oxlint-disable-next-line react/forbid-component-props -- DialogDescription accepts className in its styling contract; preserve this caller's layout and appearance.
                className="truncate"
              >
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  connector?.url ? getUrlWithoutParams(connector.url) : null
                }
              </DialogDescription /* oxlint-enable oxc/no-optional-chaining */>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex gap-4">
            <Shield
              // oxlint-disable-next-line react/forbid-component-props -- Shield accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div>
              <p className="text-sm font-medium">
                Permissions always respected
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {config.appName} is strictly limited to permissions you
                explicitly set. Disable access anytime to revoke permissions.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Lock
              // oxlint-disable-next-line react/forbid-component-props -- Lock accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div>
              <p className="text-sm font-medium">
                How {config.appName} uses data
              </p>
              <p
                /* oxlint-disable oxc/no-optional-chaining -- Keep this JSX structure; narrower inline directives make pinned Oxfmt add or restructure JSX text/expression nodes. Keep the existing nullish guard when reading name from connector; preserve one receiver evaluation, skipped accesses and the existing "this connector" fallback. */ className="text-muted-foreground mt-1 text-sm"
              >
                By default, we do not train on your data. Data from{" "}
                {connector?.name ?? "this connector"} may be used to provide you
                relevant and useful information.
              </p /* oxlint-enable oxc/no-optional-chaining */>
            </div>
          </div>

          <div className="flex gap-4">
            <AlertTriangle
              // oxlint-disable-next-line react/forbid-component-props -- AlertTriangle accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div>
              <p className="text-sm font-medium">
                Connectors may introduce risk
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Connectors are designed to respect your privacy, but sites may
                attempt to steal your data.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter
          // oxlint-disable-next-line react/forbid-component-props -- DialogFooter accepts className in its styling contract; preserve this caller's layout and appearance.
          className="mt-4 flex-col gap-3 sm:flex-col"
        >
          <Button /* oxlint-disable oxc/no-optional-chaining -- Keep this JSX structure; narrower inline directives make pinned Oxfmt add or restructure JSX text/expression nodes. Keep the existing nullish guard when reading name from connector; preserve one receiver evaluation, skipped accesses and the existing "connector" fallback. */
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
            className="w-full"
            disabled={isPending || isRedirecting || !connector}
            onClick={handleContinue}
          >
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              isPending || isRedirecting ? (
                <>
                  <Loader2
                    // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-4 animate-spin"
                  />
                  Redirecting...
                </>
              ) : (
                <>
                  Continue to {connector?.name ?? "connector"}
                  <ExternalLink
                    // oxlint-disable-next-line react/forbid-component-props -- ExternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-4"
                  />
                </>
              )
            }
          </Button /* oxlint-enable oxc/no-optional-chaining */>
          <Button
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
            className="w-full"
            onClick={handleClose}
            variant="ghost"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
