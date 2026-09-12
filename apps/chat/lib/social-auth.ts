import { AUTHENTICATION_DEFAULTS } from "./config-schema";
import type { AuthenticationConfig } from "./config-schema";

export type SocialAuthSignInOptions = {
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
};

export type SocialAuthProvider = keyof AuthenticationConfig;

const SOCIAL_AUTH_PROVIDER_IDS = Object.keys(
  AUTHENTICATION_DEFAULTS
) as SocialAuthProvider[];

const SOCIAL_AUTH_PROVIDER_ID_SET = new Set<string>(SOCIAL_AUTH_PROVIDER_IDS);

export const isSocialAuthProvider = (
  value: string | null | undefined
): value is SocialAuthProvider =>
  typeof value === "string" && SOCIAL_AUTH_PROVIDER_ID_SET.has(value);

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
