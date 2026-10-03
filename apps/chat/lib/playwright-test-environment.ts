/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): isEnabledFlag intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const isEnabledFlag = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalizedValue);
};
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * node/no-process-env (#537): isPlaywrightTestEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/prefer-readonly-parameter-types (#565): isPlaywrightTestEnvironment accepts env: NodeJS.ProcessEnv = process.env; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): isPlaywrightTestEnvironment intentionally keeps the existing falsy-value behavior of env.PLAYWRIGHT_TEST_BASE_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const isPlaywrightTestEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): boolean =>
  Boolean(
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
    env.PLAYWRIGHT_TEST_BASE_URL ||
    isEnabledFlag(env.PLAYWRIGHT) ||
    isEnabledFlag(env.CI_PLAYWRIGHT)
  );
/* oxlint-enable node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
