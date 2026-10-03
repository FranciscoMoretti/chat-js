import type { AuthenticationConfig } from "./config-schema";

/* oxlint-disable import/exports-last, import/group-exports, typescript/consistent-type-definitions --
 * import/exports-last (#522): SocialAuthSignInOptions is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): SocialAuthSignInOptions stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): SocialAuthSignInOptions preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type SocialAuthSignInOptions = {
  disableRedirect?: boolean;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
};
/* oxlint-enable import/exports-last, import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): SocialAuthProvider is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): SocialAuthProvider stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type SocialAuthProvider = keyof AuthenticationConfig;
/* oxlint-enable import/exports-last, import/group-exports */

// Keep the sign-in buttons in product order, independent of config key order.
const SOCIAL_AUTH_PROVIDER_ORDER: Record<SocialAuthProvider, number> = {
  github: 1,
  google: 0,
  vercel: 2,
};

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): isSocialAuthProvider is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): isSocialAuthProvider stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isSocialAuthProvider = (
  value: string | null | undefined
): value is SocialAuthProvider =>
  typeof value === "string" && Object.hasOwn(SOCIAL_AUTH_PROVIDER_ORDER, value);
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable id-length --
 * id-length (#506): SOCIAL_AUTH_PROVIDER_IDS uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
const SOCIAL_AUTH_PROVIDER_IDS = Object.keys(SOCIAL_AUTH_PROVIDER_ORDER)
  .filter((provider) => isSocialAuthProvider(provider))
  .toSorted(
    (a, b) => SOCIAL_AUTH_PROVIDER_ORDER[a] - SOCIAL_AUTH_PROVIDER_ORDER[b]
  );
/* oxlint-enable id-length */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): getEnabledSocialAuthProviders stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const getEnabledSocialAuthProviders = (
  authentication: AuthenticationConfig
): SocialAuthProvider[] =>
  SOCIAL_AUTH_PROVIDER_IDS.filter((provider) => authentication[provider]);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): sortSocialAuthProvidersByLastUsed stays exported at its declaration so its public contract is visible beside its implementation.
 */
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
/* oxlint-enable import/group-exports */
