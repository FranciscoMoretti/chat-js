"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { usePathname, useSearchParams } from "next/navigation";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useMemo, useRef, useState } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
/* oxlint-enable sort-imports */
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";
import { isElectronTransferQuery } from "@/lib/electron-auth";

type DeviceLoginState = "checking-session" | "transferring" | "waiting-for-app";

const DEVICE_LOGIN_COMPLETED_PARAM = "done";
/* oxlint-disable react/jsx-no-literals -- DeviceAuthScreen renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth -- DeviceAuthScreen: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DeviceAuthScreen = ({
  state,
  onRetry,
}: {
  readonly state: "checking-session" | "transferring" | "waiting-for-app";
  readonly onRetry: () => void;
}): React.JSX.Element => {
  const isLoading = state === "checking-session" || state === "transferring";
  let title = "You're signed in";

  if (isLoading) {
    title =
      state === "checking-session"
        ? "Checking your session..."
        : "Opening the desktop app...";
  }

  return (
    <div className="bg-background flex min-h-dvh w-screen items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <Card>
          <CardHeader
            // oxlint-disable-next-line react/forbid-component-props -- CardHeader accepts className in its styling contract; preserve this caller's layout and appearance.
            className="text-center"
          >
            <div className="mb-2 flex justify-center">
              {isLoading ? (
                <LoaderCircle
                  // oxlint-disable-next-line react/forbid-component-props -- LoaderCircle accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="text-muted-foreground size-8 animate-spin"
                />
              ) : (
                <div className="bg-foreground text-background inline-flex h-14 w-14 items-center justify-center rounded-2xl">
                  <CheckCircle2
                    // oxlint-disable-next-line react/forbid-component-props -- CheckCircle2 accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-7"
                  />
                </div>
              )}
            </div>
            <CardTitle
              // oxlint-disable-next-line react/forbid-component-props -- CardTitle accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-xl"
            >
              {title}
            </CardTitle>
            {!isLoading && (
              <CardDescription>
                You can close this tab and return to {config.appName}.
              </CardDescription>
            )}
          </CardHeader>
          {!isLoading && (
            <CardContent
              // oxlint-disable-next-line react/forbid-component-props -- CardContent accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-center"
            >
              <div className="mb-4">
                <Button
                  asChild
                  // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="w-full"
                  variant="outline"
                >
                  <Link href="/">Continue on web</Link>
                </Button>
              </div>
              <p className="text-muted-foreground/60 text-xs">
                Didn&apos;t open?{" "}
                <Button
                  // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="text-muted-foreground/60 hover:text-muted-foreground h-auto p-0 text-xs underline underline-offset-2 hover:no-underline"
                  onClick={onRetry}
                  type="button"
                  variant="link"
                >
                  Try again
                </Button>
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DeviceLoginPage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp -- DeviceLoginPage: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const DeviceLoginPage = (): ReactJSX.Element => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<DeviceLoginState>("checking-session");
  const transferStartedRef = useRef(false);

  const query = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams]
  );
  const isCompletedView =
    searchParams.get(DEVICE_LOGIN_COMPLETED_PARAM) === "1";
  const shouldWaitForApp = isCompletedView || !isElectronTransferQuery(query);
  const displayState =
    shouldWaitForApp && state === "checking-session"
      ? "waiting-for-app"
      : state;

  useEffect(() => {
    if (shouldWaitForApp) {
      return;
    }

    let cancelled = false;

    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkSession's awaited sequencing and rejected-Promise behavior. */
    const checkSession = async (): Promise<void> => {
      const { data: session } = await authClient.getSession();

      if (cancelled || transferStartedRef.current) {
        return;
      }

      if (!session?.user) {
        setState("waiting-for-app");
        return;
      }

      transferStartedRef.current = true;
      setState("transferring");

      await authClient.electron.transferUser({
        fetchOptions: {
          onError: () => {
            transferStartedRef.current = false;
            setState("waiting-for-app");
          },
          onSuccess: () => {
            globalThis.history.replaceState(
              {},
              "",
              `${pathname}?${DEVICE_LOGIN_COMPLETED_PARAM}=1`
            );
            setState("waiting-for-app");
          },
          query,
        },
      });
    };
    /* oxlint-enable oxc/no-async-await */
    const sessionCheck = checkSession();
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
    void (async (): Promise<void> => {
      try {
        await sessionCheck;
      } catch {
        if (cancelled) {
          return;
        }

        transferStartedRef.current = false;
        setState("waiting-for-app");
      }
    })();
    /* oxlint-enable oxc/no-async-await */
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return (): void => {
      cancelled = true;
    };
  }, [pathname, query, shouldWaitForApp]);

  return (
    <DeviceAuthScreen
      onRetry={() => {
        transferStartedRef.current = false;
        setState("transferring");
        const transfer = authClient.electron.transferUser({
          fetchOptions: {
            onError: () => {
              transferStartedRef.current = false;
              setState("waiting-for-app");
            },
            onSuccess: () => {
              globalThis.history.replaceState(
                {},
                "",
                `${pathname}?${DEVICE_LOGIN_COMPLETED_PARAM}=1`
              );
              setState("waiting-for-app");
            },
            query,
          },
        });
        /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
        void (async (): Promise<void> => {
          try {
            await transfer;
          } catch {
            transferStartedRef.current = false;
            setState("waiting-for-app");
          }
        })();
        /* oxlint-enable oxc/no-async-await */
      }}
      state={displayState}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp */
