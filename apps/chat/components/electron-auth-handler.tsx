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
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
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

                // oxlint-disable-next-line typescript/no-misused-promises -- #585: Electron cancellation catches and reports bridge failures inside the handler.
                onClick={async () => {
                  try {
                    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
                    await window.electronAPI?.cancelAuthFlow?.();
                  } catch (error) {
                    console.error("Failed to cancel Electron auth flow", error);
                  }
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
    message: null,
    status: "idle",
  });

  useEffect(() => {
    if (!isDesktopAppEnabled) {
      return;
    }

    const id = authClient.ensureElectronRedirect();
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return () => clearInterval(id);
  }, [isDesktopAppEnabled]);

  useEffect(() => {
    if (!isDesktopAppEnabled) {
      return;
    }

    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    if (typeof window.requestAuth !== "function") {
      return;
    }

    if (
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      typeof window.onAuthenticated !== "function" ||
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      typeof window.onUserUpdated !== "function" ||
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      typeof window.onAuthError !== "function" ||
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      typeof window.electronAPI?.onAuthStateChanged !== "function"
    ) {
      return;
    }

    const loadAuthState = async () => {
      try {
        // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
        const state = await window.electronAPI?.getAuthState?.();
        if (state) {
          setAuthState(state);
        }
      } catch (error) {
        console.error("Failed to read Electron auth state", error);
      }
    };

    void loadAuthState();

    const syncAndRefresh = async () => {
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      await window.electronAPI?.syncAuthSession?.();
      router.refresh();
    };

    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeAuthenticated = window.onAuthenticated(() => {
      const syncAuthenticatedSession = async () => {
        try {
          await syncAndRefresh();
        } catch (error) {
          console.error(
            "Failed to sync auth session after authentication",
            error
          );
        }
      };
      void syncAuthenticatedSession();
    });
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeUserUpdated = window.onUserUpdated(() => {
      const syncUpdatedUser = async () => {
        try {
          await syncAndRefresh();
        } catch (error) {
          console.error("Failed to sync auth session after user update", error);
        }
      };
      void syncUpdatedUser();
    });
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeAuthError = window.onAuthError(
      (ctx: ElectronAuthErrorContext) => {
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
        toast.error(ctx.message || "Authentication failed");
      }
    );
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeAuthState = window.electronAPI.onAuthStateChanged(
      (state) => {
        setAuthState(state);
      }
    );

    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
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
