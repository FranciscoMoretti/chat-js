import type { AuthenticationConfig } from "./config-schema";

export type SocialAuthSignInOptions = {
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
};

export type SocialAuthProvider = keyof AuthenticationConfig;

// Keep the sign-in buttons in product order, independent of config key order.
const SOCIAL_AUTH_PROVIDER_ORDER: Record<SocialAuthProvider, number> = {
  github: 1,
  google: 0,
  vercel: 2,
};

export const isSocialAuthProvider = (
  value: string | null | undefined
): value is SocialAuthProvider =>
  typeof value === "string" && Object.hasOwn(SOCIAL_AUTH_PROVIDER_ORDER, value);

const SOCIAL_AUTH_PROVIDER_IDS = Object.keys(SOCIAL_AUTH_PROVIDER_ORDER)
  .filter(isSocialAuthProvider)
  .toSorted(
    (a, b) => SOCIAL_AUTH_PROVIDER_ORDER[a] - SOCIAL_AUTH_PROVIDER_ORDER[b]
  );

export const getEnabledSocialAuthProviders = (
  authentication: AuthenticationConfig
): SocialAuthProvider[] =>
  SOCIAL_AUTH_PROVIDER_IDS.filter((provider) => authentication[provider]);

export const sortSocialAuthProvidersByLastUsed = <
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
