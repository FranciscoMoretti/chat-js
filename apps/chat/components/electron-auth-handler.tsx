"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";

const ElectronAuthOverlay = ({
  state,
}: {
  state: ElectronRendererAuthState;
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (state.status === "idle" || !state.message) {
    return null;
  }

  const isLoading =
    state.status === "awaiting-browser" || state.status === "finishing";
  const canCancel = state.status === "awaiting-browser";
  let detailMessage: string;

  if (state.status === "awaiting-browser") {
    detailMessage = "Complete sign-in in your browser, then come back here.";
  } else if (state.status === "finishing") {
    detailMessage =
      "Your browser has returned to ChatJS. We're finalizing the session now.";
  } else {
    detailMessage =
      state.detail || "If nothing changes, try the browser flow again.";
  }

  if (!isLoading && isDismissed) {
    return null;
  }

  return (
    <div className="bg-background/90 pointer-events-auto fixed inset-0 z-[999999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="bg-background w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="text-muted-foreground mt-0.5">
            {isLoading ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <AlertCircle className="size-5 text-amber-600" />
            )}
          </div>
          <div className="space-y-2">
            <p className="font-medium">{state.message}</p>
            <p className="text-muted-foreground text-sm">{detailMessage}</p>
            {canCancel ? (
              <Button
                className="mt-2"
                onClick={() => {
                  window.electronAPI?.cancelAuthFlow?.().catch((error) => {
                    console.error("Failed to cancel Electron auth flow", error);
                  });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Go back
              </Button>
            ) : null}
            {isLoading ? null : (
              <Button
                className="mt-2"
                onClick={() => setIsDismissed(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Handles the electron auth redirect after OAuth completes in the browser.
 * When the user finishes OAuth, `ensureElectronRedirect` detects the
 * electron redirect cookie and sends the user back to the Electron app
 * via deep link.
 *
 * Mount this in the root layout so it runs on every page.
 */
export const ElectronAuthHandler = () => {
  const isDesktopAppEnabled = config.desktopApp.enabled;
  const router = useRouter();
  const [authState, setAuthState] = useState<ElectronRendererAuthState>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    if (!isDesktopAppEnabled) {
      return;
    }

    const id = authClient.ensureElectronRedirect();
    return () => clearInterval(id);
  }, [isDesktopAppEnabled]);

  useEffect(() => {
    if (!isDesktopAppEnabled) {
      return;
    }

    if (typeof window.requestAuth !== "function") {
      return;
    }

    if (
      typeof window.onAuthenticated !== "function" ||
      typeof window.onUserUpdated !== "function" ||
      typeof window.onAuthError !== "function" ||
      typeof window.electronAPI?.onAuthStateChanged !== "function"
    ) {
      return;
    }

    const authStatePromise = window.electronAPI?.getAuthState?.();
    authStatePromise
      ?.then((state) => {
        if (state) {
          setAuthState(state);
        }
      })
      ?.catch((error) => {
        console.error("Failed to read Electron auth state", error);
      });

    const syncAndRefresh = async () => {
      await window.electronAPI?.syncAuthSession?.();
      router.refresh();
    };

    const unsubscribeAuthenticated = window.onAuthenticated(() => {
      syncAndRefresh().catch((error) => {
        console.error(
          "Failed to sync auth session after authentication",
          error
        );
      });
    });
    const unsubscribeUserUpdated = window.onUserUpdated(() => {
      syncAndRefresh().catch((error) => {
        console.error("Failed to sync auth session after user update", error);
      });
    });
    const unsubscribeAuthError = window.onAuthError(
      (ctx: ElectronAuthErrorContext) => {
        toast.error(ctx.message || "Authentication failed");
      }
    );
    const unsubscribeAuthState = window.electronAPI.onAuthStateChanged(
      (state) => {
        setAuthState(state);
      }
    );

    return () => {
      unsubscribeAuthenticated();
      unsubscribeUserUpdated();
      unsubscribeAuthError();
      unsubscribeAuthState();
    };
  }, [isDesktopAppEnabled, router]);

  if (!isDesktopAppEnabled) {
    return null;
  }

  const overlayKey = `${authState.status}:${authState.message ?? ""}:${
    authState.status === "idle" ? "" : (authState.detail ?? "")
  }`;

  return <ElectronAuthOverlay key={overlayKey} state={authState} />;
};
