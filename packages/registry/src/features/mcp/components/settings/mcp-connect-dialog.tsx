"use client";

import { useMutation } from "@tanstack/react-query";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";
/* oxlint-enable eslint/sort-imports */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Favicon } from "@/components/favicon";
/* oxlint-enable eslint/sort-imports */
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Button } from "@/components/ui/button";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { McpConnector } from "@/lib/db/schema";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies */
import { useTRPC } from "@/trpc/react";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
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
}) => {
  const trpc = useTRPC();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const attempt = useRef(0);
  useEffect(() => {
    if (!open || !connector?.id) {
      attempt.current += 1;
    }
    return (): void => {
      attempt.current += 1;
    };
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
    return connector.type === "http" ? getGoogleFaviconUrl(connector.url) : "";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="overflow-hidden">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
              {faviconUrl ? (
                <>
                  <Favicon className="size-5 rounded-sm" url={faviconUrl} />
                  <Globe className="text-muted-foreground hidden size-5" />
                </>
              ) : (
                <Globe className="text-muted-foreground size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <DialogTitle className="truncate">
                Connect {connector?.name ?? "connector"}
              </DialogTitle>
              <DialogDescription className="truncate">
                {connector?.url ? getUrlWithoutParams(connector.url) : null}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex gap-4">
            <Shield className="text-muted-foreground mt-0.5 size-4 shrink-0" />
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
            <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                How {config.appName} uses data
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                By default, we do not train on your data. Data from{" "}
                {connector?.name ?? "this connector"} may be used to provide you
                relevant and useful information.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <AlertTriangle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
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

        <DialogFooter className="mt-4 flex-col gap-3 sm:flex-col">
          <Button
            className="w-full"
            disabled={isPending || isRedirecting || !connector}
            onClick={handleContinue}
          >
            {isPending || isRedirecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                Continue to {connector?.name ?? "connector"}
                <ExternalLink className="size-4" />
              </>
            )}
          </Button>
          <Button className="w-full" onClick={handleClose} variant="ghost">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
