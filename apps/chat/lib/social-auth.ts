import type { AuthenticationConfig } from "./config-schema";

interface SocialAuthSignInOptions {
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
}

type SocialAuthProvider = keyof AuthenticationConfig;

// Keep the sign-in buttons in product order, independent of config key order.
const SOCIAL_AUTH_PROVIDER_ORDER: Record<SocialAuthProvider, number> = {
  github: 1,
  google: 0,
  vercel: 2,
};

const isSocialAuthProvider = (
  value: string | null | undefined
): value is SocialAuthProvider =>
  typeof value === "string" && Object.hasOwn(SOCIAL_AUTH_PROVIDER_ORDER, value);

const SOCIAL_AUTH_PROVIDER_IDS = Object.keys(SOCIAL_AUTH_PROVIDER_ORDER)
  .filter((provider) => isSocialAuthProvider(provider))
  .toSorted(
    (leftProvider, rightProvider) =>
      SOCIAL_AUTH_PROVIDER_ORDER[leftProvider] -
      SOCIAL_AUTH_PROVIDER_ORDER[rightProvider]
  );

const getEnabledSocialAuthProviders = (
  authentication: AuthenticationConfig
): SocialAuthProvider[] =>
  SOCIAL_AUTH_PROVIDER_IDS.filter((provider) => authentication[provider]);

const sortSocialAuthProvidersByLastUsed = <
  TProvider extends { id: SocialAuthProvider },
>(
  providers: readonly TProvider[],
  lastUsedProvider: string | null | undefined
): TProvider[] => {
  if (!isSocialAuthProvider(lastUsedProvider)) {
    return [...providers];
  }

  return [
    ...providers.filter(({ id }) => id === lastUsedProvider),
    ...providers.filter(({ id }) => id !== lastUsedProvider),
  ];
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isSocialAuthProvider, getEnabledSocialAuthProviders, sortSocialAuthProvidersByLastUsed); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  isSocialAuthProvider,
  getEnabledSocialAuthProviders,
  sortSocialAuthProvidersByLastUsed,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SocialAuthSignInOptions, SocialAuthProvider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { SocialAuthSignInOptions, SocialAuthProvider };
/* oxlint-enable import/no-named-export */
