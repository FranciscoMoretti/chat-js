"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";
import { isElectronTransferQuery } from "@/lib/electron-auth";
/* oxlint-enable sort-imports */

type DeviceLoginState = "checking-session" | "transferring" | "waiting-for-app";

const DEVICE_LOGIN_COMPLETED_PARAM = "done";
/* oxlint-disable max-lines-per-function, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- DeviceAuthScreen: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DeviceAuthScreen = ({
  state,
  onRetry,
}: {
  state: "checking-session" | "transferring" | "waiting-for-app";
  onRetry: () => void;
}) => {
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
          <CardHeader className="text-center">
            <div className="mb-2 flex justify-center">
              {isLoading ? (
                <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
              ) : (
                <div className="bg-foreground text-background inline-flex h-14 w-14 items-center justify-center rounded-2xl">
                  <CheckCircle2 className="size-7" />
                </div>
              )}
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            {!isLoading && (
              <CardDescription>
                You can close this tab and return to {config.appName}.
              </CardDescription>
            )}
          </CardHeader>
          {!isLoading && (
            <CardContent className="text-center">
              <div className="mb-4">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/">Continue on web</Link>
                </Button>
              </div>
              <p className="text-muted-foreground/60 text-xs">
                Didn&apos;t open?{" "}
                <Button
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
/* oxlint-enable max-lines-per-function, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- DeviceLoginPage: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including session?.user); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const DeviceLoginPage = () => {
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

    const checkSession = async () => {
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

    const sessionCheck = checkSession();
    void (async () => {
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

    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return () => {
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
        void (async () => {
          try {
            await transfer;
          } catch {
            transferStartedRef.current = false;
            setState("waiting-for-app");
          }
        })();
      }}
      state={displayState}
    />
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
