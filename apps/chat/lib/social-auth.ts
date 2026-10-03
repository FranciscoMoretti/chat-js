import type { AuthenticationConfig } from "./config-schema";

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): SocialAuthSignInOptions preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type SocialAuthSignInOptions = {
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
};
/* oxlint-enable typescript/consistent-type-definitions */

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

/* oxlint-disable id-length --
 * id-length (#506): SOCIAL_AUTH_PROVIDER_IDS uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
const SOCIAL_AUTH_PROVIDER_IDS = Object.keys(SOCIAL_AUTH_PROVIDER_ORDER)
  .filter((provider) => isSocialAuthProvider(provider))
  .toSorted(
    (a, b) => SOCIAL_AUTH_PROVIDER_ORDER[a] - SOCIAL_AUTH_PROVIDER_ORDER[b]
  );
/* oxlint-enable id-length */

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

export {
  isSocialAuthProvider,
  getEnabledSocialAuthProviders,
  sortSocialAuthProvidersByLastUsed,
};
export type { SocialAuthSignInOptions, SocialAuthProvider };
