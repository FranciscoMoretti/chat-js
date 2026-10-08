"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

import config from "@/chat.config";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Session } from "@/lib/auth";
/* oxlint-enable sort-imports */
import authClient from "@/lib/auth-client";
// oxlint-disable-next-line sort-imports -- The readonly session data view follows the existing runtime import grouping.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "./ui/button";
/* oxlint-disable react/jsx-no-literals -- ElectronBrowserSignIn renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
/* oxlint-disable no-console, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- ElectronBrowserSignIn: no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 300); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
          globalThis.setTimeout(() => setOpened(true), 300);
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
/* oxlint-enable no-console, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, unicorn/no-null */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp -- ElectronTransferUser: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

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
