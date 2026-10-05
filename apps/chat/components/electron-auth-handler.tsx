"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { useEffect, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-console, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null -- ElectronAuthOverlay: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { state, }: { state: ElectronRendererAuthState; }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including state.detail); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ElectronAuthOverlay = ({
  state,
}: {
  state: ElectronRendererAuthState;
}): ReactJSX.Element | null => {
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return (
    <div className="bg-background/90 pointer-events-auto fixed inset-0 z-[999999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="bg-background w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="text-muted-foreground mt-0.5">
            {isLoading ? (
              <LoaderCircle
                // oxlint-disable-next-line react/forbid-component-props -- LoaderCircle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-5 animate-spin"
              />
            ) : (
              <AlertCircle
                // oxlint-disable-next-line react/forbid-component-props -- AlertCircle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-5 text-amber-600"
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="font-medium">{state.message}</p>
            <p className="text-muted-foreground text-sm">{detailMessage}</p>
            {canCancel ? (
              <Button
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-console, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null */
/* oxlint-disable jsdoc/require-returns, max-lines-per-function, max-statements, no-console, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ElectronAuthHandler: ; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including ctx: ElectronAuthErrorContext); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including ctx.message); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/**
 * Handles the electron auth redirect after OAuth completes in the browser.
 * When the user finishes OAuth, `ensureElectronRedirect` detects the
 * electron redirect cookie and sends the user back to the Electron app
 * via deep link.
 *
 * Mount this in the root layout so it runs on every page.
 */
export const ElectronAuthHandler = (): ReactJSX.Element | null => {
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
    return (): void => clearInterval(id);
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

    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve loadAuthState's awaited sequencing and rejected-Promise behavior. */
    const loadAuthState = async (): Promise<void> => {
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
    /* oxlint-enable oxc/no-async-await */
    void loadAuthState();

    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncAndRefresh's awaited sequencing and rejected-Promise behavior. */
    const syncAndRefresh = async (): Promise<void> => {
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
      await window.electronAPI?.syncAuthSession?.();
      router.refresh();
    };
    /* oxlint-enable oxc/no-async-await */
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeAuthenticated = window.onAuthenticated(() => {
      /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncAuthenticatedSession's awaited sequencing and rejected-Promise behavior. */
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
      /* oxlint-enable oxc/no-async-await */
      void syncAuthenticatedSession();
    });
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
    const unsubscribeUserUpdated = window.onUserUpdated(() => {
      /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncUpdatedUser's awaited sequencing and rejected-Promise behavior. */
      const syncUpdatedUser = async (): Promise<void> => {
        try {
          await syncAndRefresh();
        } catch (error) {
          console.error("Failed to sync auth session after user update", error);
        }
      };
      /* oxlint-enable oxc/no-async-await */
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
    return (): void => {
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
/* oxlint-enable jsdoc/require-returns, max-lines-per-function, max-statements, no-console, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
