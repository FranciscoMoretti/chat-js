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

export function isSocialAuthProvider(
  value: string | null | undefined
): value is SocialAuthProvider {
  return typeof value === "string" && SOCIAL_AUTH_PROVIDER_ID_SET.has(value);
}

export function getEnabledSocialAuthProviders(
  authentication: AuthenticationConfig
): SocialAuthProvider[] {
  return SOCIAL_AUTH_PROVIDER_IDS.filter(
    (provider) => authentication[provider]
  );
}

export function sortSocialAuthProvidersByLastUsed<
  TProvider extends { id: SocialAuthProvider },
>(
  providers: readonly TProvider[],
  lastUsedProvider: string | null | undefined
): TProvider[] {
  if (!isSocialAuthProvider(lastUsedProvider)) {
    return [...providers];
  }

  return [
    ...providers.filter(({ id }) => id === lastUsedProvider),
    ...providers.filter(({ id }) => id !== lastUsedProvider),
  ];
}
