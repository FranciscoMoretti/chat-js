"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import config from "@/chat.config";
import type { Session } from "@/lib/auth";
import authClient from "@/lib/auth-client";

import { Button } from "./ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable import/group-exports, import/no-named-export, no-console, no-magic-numbers, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ElectronBrowserSignIn: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 300); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ElectronBrowserSignIn = ({
  buttonLabel = "Continue with browser",
}: {
  buttonLabel?: string;
}) => {
  const [opened, setOpened] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">
        Sign-in opens in your browser. On macOS, {config.appName} may ask to use
        Keychain so it can store your session securely.
      </p>
      <Button
        className="w-full"
        onClick={() => {
          // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
          const { requestAuth } = window;
          if (typeof requestAuth !== "function") {
            return;
          }
          const launchBrowserSignIn = async () => {
            try {
              await Promise.resolve();
              await requestAuth();
            } catch (error) {
              console.error("Failed to launch browser sign-in", error);
            }
          };
          void launchBrowserSignIn();
          globalThis.setTimeout(() => setOpened(true), 300);
        }}
        type="button"
        variant="outline"
      >
        <ExternalLink className="mr-2 size-4" />
        {buttonLabel}
      </Button>

      {opened ? (
        <p className="text-muted-foreground text-center text-sm">
          Finish signing in through your browser. If macOS asks about Keychain
          access, allow it to keep your session saved securely.
        </p>
      ) : null}
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-console, no-magic-numbers, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export, max-lines-per-function, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ElectronTransferUser: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including nextQuery ? /login?${nextQuery} : "/login"); oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ElectronTransferUser = ({
  query,
  session,
}: {
  query: Record<string, string>;
  session: Session;
}) => {
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
    return nextQuery ? `/login?${nextQuery}` : "/login";
  }, [query]);

  useEffect(() => {
    if (hasStartedTransferRef.current) {
      return;
    }
    hasStartedTransferRef.current = true;

    startTransition(async () => {
      await authClient.electron.transferUser({ fetchOptions: { query } });
      router.refresh();
    });
  }, [query, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">{session.user.name || session.user.email}</p>
        <p className="text-muted-foreground">{session.user.email}</p>
      </div>

      <Button
        className="w-full"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await authClient.electron.transferUser({ fetchOptions: { query } });
            router.refresh();
          });
        }}
        type="button"
      >
        {isPending ? (
          <>
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          "Continue to desktop app"
        )}
      </Button>

      <Button asChild className="w-full" variant="ghost">
        <a href={useAnotherAccountHref}>Use another account</a>
      </Button>
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, max-lines-per-function, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
