"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import type { JSX as ReactJSX } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { Session } from "@/lib/auth";

import config from "@/chat.config";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/chat.config and @/lib/auth-client; keep this adjacent import pair ordered. */
import authClient from "@/lib/auth-client";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/lib/auth-client and ./ui/button; keep this adjacent import pair ordered. */
import { Button } from "./ui/button";
/* oxlint-enable sort-imports */

import { useRouter } from "next/navigation";

const AUTH_FEEDBACK_DELAY_MS = 300;

/* oxlint-disable react/jsx-no-literals -- ElectronBrowserSignIn renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-console, react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- ElectronBrowserSignIn: no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ElectronBrowserSignIn = ({
  buttonLabel = "Continue with browser",
}: {
  readonly buttonLabel?: string;
}): ReactJSX.Element => {
  const [opened, setOpened] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">
        Sign-in opens in your browser. On macOS, {config.appName} may ask to use
        Keychain so it can store your session securely.
      </p>
      <Button
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full"
        onClick={() => {
          // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
          const { requestAuth } = window;
          if (typeof requestAuth !== "function") {
            return;
          }
          /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve launchBrowserSignIn's awaited sequencing and rejected-Promise behavior. */
          const launchBrowserSignIn = async (): Promise<void> => {
            try {
              await Promise.resolve();
              await requestAuth();
            } catch (error) {
              console.error("Failed to launch browser sign-in", error);
            }
          };
          /* oxlint-enable oxc/no-async-await */
          void launchBrowserSignIn();
          globalThis.setTimeout(() => setOpened(true), AUTH_FEEDBACK_DELAY_MS);
        }}
        type="button"
        variant="outline"
      >
        <ExternalLink
          // oxlint-disable-next-line react/forbid-component-props -- ExternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
          className="mr-2 size-4"
        />
        {buttonLabel}
      </Button /* oxlint-disable no-ternary -- Keep the opened browser-sign-in status as lazy JSX values; equivalent if/else assignments conflict with pinned unicorn/prefer-ternary. */>

      {opened ? (
        <p className="text-muted-foreground text-center text-sm">
          Finish signing in through your browser. If macOS asks about Keychain
          access, allow it to keep your session saved securely.
        </p>
      ) : null}
    </div /* oxlint-enable no-ternary */>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ElectronTransferUser renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable no-console, react-perf/jsx-no-new-function-as-prop, unicorn/no-null */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp -- ElectronTransferUser: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ElectronTransferUser = ({
  query,
  session,
}: {
  readonly query: Readonly<Record<string, string>>;
  readonly session: ReadonlyNativeSurface<Session>;
}): ReactJSX.Element => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasStartedTransferRef = useRef(false);
  const useAnotherAccountHref = useMemo(() => {
    const params = new URLSearchParams(query);
    params.delete("client_id");
    params.delete("state");
    params.delete("code_challenge");
    params.delete("code_challenge_method");

    const nextQuery = params.toString();
    if (nextQuery) {
      return `/login?${nextQuery}`;
    }
    return "/login";
  }, [query]);

  useEffect(() => {
    if (hasStartedTransferRef.current) {
      return;
    }
    hasStartedTransferRef.current = true;

    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve startTransition's awaited sequencing and rejected-Promise behavior. */
    startTransition(async () => {
      await authClient.electron.transferUser({ fetchOptions: { query } });
      router.refresh();
    });
    /* oxlint-enable oxc/no-async-await */
  }, [query, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">{session.user.name || session.user.email}</p>
        <p className="text-muted-foreground">{session.user.email}</p>
      </div>

      <Button
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full"
        disabled={isPending}
        onClick={() => {
          /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve startTransition's awaited sequencing and rejected-Promise behavior. */
          startTransition(async () => {
            await authClient.electron.transferUser({ fetchOptions: { query } });
            router.refresh();
          });
          /* oxlint-enable oxc/no-async-await */
        }}
        type="button"
      >
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          isPending ? (
            <>
              <LoaderCircle
                // oxlint-disable-next-line react/forbid-component-props -- LoaderCircle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mr-2 size-4 animate-spin"
              />
              Connecting…
            </>
          ) : (
            "Continue to desktop app"
          )
        }
      </Button>

      <Button
        asChild
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full"
        variant="ghost"
      >
        <a href={useAnotherAccountHref}>Use another account</a>
      </Button>
    </div>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ElectronBrowserSignIn, ElectronTransferUser); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp */
export { ElectronBrowserSignIn, ElectronTransferUser };
/* oxlint-enable import/no-named-export */
