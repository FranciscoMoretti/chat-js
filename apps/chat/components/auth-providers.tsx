"use client";

import { Github } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType, JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
import React, { useMemo } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ElectronBrowserSignIn } from "@/components/electron-auth-ui";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  SocialAuthProvider,
  SocialAuthSignInOptions,
} from "@/lib/social-auth";
/* oxlint-enable sort-imports */
import {
  getEnabledSocialAuthProviders,
  isSocialAuthProvider,
  sortSocialAuthProvidersByLastUsed,
} from "@/lib/social-auth";

const emptyQuery: Record<string, string> = {};
/* oxlint-disable react/jsx-no-literals -- GoogleIcon renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

const GoogleIcon = ({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element => (
  <svg className={className} viewBox="0 0 24 24">
    <title>Google</title>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- VercelIcon renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react/no-multi-comp -- VercelIcon: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className }: { className?: string }). */

const VercelIcon = ({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <title>Vercel</title>
    <path d="M12 1L24 22H0L12 1z" />
  </svg>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/no-multi-comp */

interface AuthProviderDefinition {
  icon: ComponentType<{ className?: string }>;
  id: SocialAuthProvider;
  label: string;
}

const AUTH_PROVIDER_METADATA = {
  github: {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the existing GitHub sign-in brand icon until its visual replacement is selected.
    icon: Github,
    label: "GitHub",
  },
  google: {
    icon: GoogleIcon,
    label: "Google",
  },
  vercel: {
    icon: VercelIcon,
    label: "Vercel",
  },
} satisfies Record<SocialAuthProvider, Omit<AuthProviderDefinition, "id">>;
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SocialAuthProviders); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SocialAuthProviders renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, no-console, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, unicorn/no-null -- SocialAuthProviders: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const SocialAuthProviders = ({
  callbackURL,
  electronBrowserLabel,
  isElectron = false,
  onRedirectToUrl,
  query = emptyQuery,
  signInOptions,
}: {
  readonly callbackURL?: string;
  readonly electronBrowserLabel?: string;
  readonly isElectron?: boolean;
  readonly onRedirectToUrl?: (url: string) => void;
  readonly query?: Readonly<Record<string, string>>;
  readonly signInOptions?: Readonly<SocialAuthSignInOptions>;
} = {}): ReactJSX.Element => {
  const lastUsedProvider = useMemo<SocialAuthProvider | null>(() => {
    const remembered = authClient.getLastUsedLoginMethod();
    if (isSocialAuthProvider(remembered)) {
      return remembered;
    }
    return null;
  }, []);

  const providers = useMemo<AuthProviderDefinition[]>(() => {
    const providerDefinitions = getEnabledSocialAuthProviders(
      config.authentication
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Add provider IDs to view records without mutating shared authentication metadata.
    ).map((id) => ({
      id,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing AUTH_PROVIDER_METADATA[id] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...AUTH_PROVIDER_METADATA[id],
    }));

    return sortSocialAuthProvidersByLastUsed(
      providerDefinitions,
      lastUsedProvider
    );
  }, [lastUsedProvider]);

  // In the Electron app, use the @better-auth/electron bridges exposed by
  // setupRenderer() in the preload script. requestAuth() opens the sign-in
  // URL in the user's default browser with the proper PKCE params.
  if (config.desktopApp.enabled && isElectron) {
    return <ElectronBrowserSignIn buttonLabel={electronBrowserLabel} />;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve signIn's awaited sequencing and rejected-Promise behavior. */
  const signIn = async (provider: SocialAuthProvider): Promise<void> => {
    try {
      const result = await authClient.signIn.social({
        callbackURL,
        provider,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing signInOptions own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...signInOptions,
        fetchOptions: {
          query,
        },
      });

      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading url from result.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const redirectUrl = result.data?.url;
      if (typeof redirectUrl === "string" && redirectUrl !== "") {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onRedirectToUrl; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
        onRedirectToUrl?.(redirectUrl);
      }
    } catch (error) {
      console.error(`Failed to start ${provider} sign-in`, error);
      toast.error("Couldn't start sign-in. Please try again.");
    }
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <div className="space-y-2">
      {providers.map(
        (
          /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
          { icon: Icon, id, label }
          /* oxlint-enable typescript/prefer-readonly-parameter-types */
        ) => {
          const isLastUsed = id === lastUsedProvider;

          return (
            <Button
              // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
              className="relative w-full"
              key={id}

              onClick={() => {
                void signIn(id);
              }}
              type="button"
              variant="outline"
            >
              <Icon
                // oxlint-disable-next-line react/forbid-component-props -- Icon accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mr-2 h-4 w-4"
              />
              Continue with {label}
              {
                // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                isLastUsed ? (
                  <Badge
                    // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="absolute top-0 right-2 h-5 -translate-y-1/2 px-1.5 text-[10px]"
                    variant="default"
                  >
                    Last used
                  </Badge>
                ) : null
              }
            </Button>
          );
        }
      )}
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-console, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, unicorn/no-null */
