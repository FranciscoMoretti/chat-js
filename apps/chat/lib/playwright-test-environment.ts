function isEnabledFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalizedValue);
}

export function isPlaywrightTestEnvironment(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(
    env.PLAYWRIGHT_TEST_BASE_URL ||
    isEnabledFlag(env.PLAYWRIGHT) ||
    isEnabledFlag(env.CI_PLAYWRIGHT)
  );
}
