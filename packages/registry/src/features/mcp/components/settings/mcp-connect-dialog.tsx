"use client";

import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Favicon } from "@/components/favicon";
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { config } from "@/lib/config";
import type { McpConnector } from "@/lib/db/schema";
import { useTRPC } from "@/trpc/react";

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
    return () => {
      attempt.current += 1;
    };
  }, [open, connector?.id]);
  const handleClose = useCallback(() => {
    attempt.current += 1;
    setIsRedirecting(false);
    onClose();
  }, [onClose]);

  const faviconUrl = useMemo(() => {
    if (!connector) {
      return "";
    }
    return connector.type === "http" ? getGoogleFaviconUrl(connector.url) : "";
  }, [connector]);

  const { mutate: authorize, isPending } = useMutation(
    trpc.mcp.authorize.mutationOptions()
  );

  const handleContinue = useCallback(() => {
    if (!connector) {
      return;
    }
    attempt.current += 1;
    const currentAttempt = attempt.current;
    authorize(
      { id: connector.id },
      {
        onError: (err) => {
          if (attempt.current === currentAttempt) {
            toast.error(err.message || "Failed to start connection");
          }
        },
        onSuccess: ({ authorizationUrl }) => {
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
    <Dialog onOpenChange={(o) => !o && handleClose()} open={open}>
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
