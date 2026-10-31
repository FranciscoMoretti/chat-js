"use client";
import type {
  ElectronAuthErrorContext,
  ElectronRendererAuthState,
} from "./bridge";

import { nonEmptyText } from "@/components/text-value";

import { AlertCircle, LoaderCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import authClient from "@/plugins/desktop/desktop-auth-client";

import { useRouter } from "next/navigation";

const ElectronAuthOverlay = ({
  state,
}: {
  readonly state: Readonly<ElectronRendererAuthState>;
}): ReactJSX.Element | null => {
  const [, startEventAction] = React.useTransition();
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
    const { detail } = state;
    detailMessage =
      typeof detail === "string" && detail !== ""
        ? detail
        : "If nothing changes, try the browser flow again.";
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
                  startEventAction(async () => {
                    try {
                      await window.electronAPI?.cancelAuthFlow?.();
                    } catch (error) {
                      console.error(
                        "Failed to cancel Electron auth flow",
                        error
                      );
                    }
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
                onClick={() => {
                  setIsDismissed(true);
                }}
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
 *
 * @returns {ReactJSX.Element | null} The current overlay, or null outside the enabled desktop flow.
 */
export const ElectronAuthHandler = (): ReactJSX.Element | null => {
  const router = useRouter();
  const [authState, setAuthState] = useState<ElectronRendererAuthState>({
    message: null,
    status: "idle",
  });

  useEffect((): (() => void) | undefined => {
    const id = authClient.ensureElectronRedirect();

    return (): void => {
      clearInterval(id);
    };
  }, []);

  useEffect((): (() => void) | undefined => {
    if (typeof window.requestAuth !== "function") {
      return undefined;
    }

    if (
      typeof window.onAuthenticated !== "function" ||
      typeof window.onUserUpdated !== "function" ||
      typeof window.onAuthError !== "function" ||
      typeof window.electronAPI?.onAuthStateChanged !== "function"
    ) {
      return undefined;
    }

    const loadAuthState = async (): Promise<void> => {
      try {
        const state = await window.electronAPI?.getAuthState?.();
        if (state) {
          setAuthState(state);
        }
      } catch (error) {
        console.error("Failed to read Electron auth state", error);
      }
    };
    void loadAuthState();

    const syncAndRefresh = async (): Promise<void> => {
      await window.electronAPI?.syncAuthSession?.();
      router.refresh();
    };
    const syncAuthenticatedSession = async (): Promise<void> => {
      try {
        await syncAndRefresh();
      } catch (error) {
        console.error(
          "Failed to sync auth session after authentication",
          error
        );
      }
    };
    const unsubscribeAuthenticated = window.onAuthenticated(() => {
      void syncAuthenticatedSession();
    });
    const syncUpdatedUser = async (): Promise<void> => {
      try {
        await syncAndRefresh();
      } catch (error) {
        console.error("Failed to sync auth session after user update", error);
      }
    };
    const unsubscribeUserUpdated = window.onUserUpdated(() => {
      void syncUpdatedUser();
    });
    const unsubscribeAuthError = window.onAuthError(
      (ctx: Readonly<ElectronAuthErrorContext>) => {
        toast.error(nonEmptyText(ctx.message) ?? "Authentication failed");
      }
    );
    const unsubscribeAuthState = window.electronAPI.onAuthStateChanged(
      (state: Readonly<ElectronRendererAuthState>) => {
        setAuthState(state);
      }
    );

    return (): void => {
      unsubscribeAuthenticated();
      unsubscribeUserUpdated();
      unsubscribeAuthError();
      unsubscribeAuthState();
    };
  }, [router]);

  const overlayKey = `${authState.status}:${authState.message ?? ""}:${
    authState.status === "idle" ? "" : (authState.detail ?? "")
  }`;

  return <ElectronAuthOverlay key={overlayKey} state={authState} />;
};
