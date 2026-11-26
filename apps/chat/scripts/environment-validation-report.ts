const EMPTY_DIAGNOSTIC_COUNT = 0;

export const reportEnvironmentFailure = (
  errors: readonly {
    readonly feature: string;
    readonly missing: readonly string[];
  }[]
): boolean => {
  if (errors.length > EMPTY_DIAGNOSTIC_COUNT) {
    const message = errors
      .map(
        (validationError: {
          readonly feature: string;
          readonly missing: readonly string[];
        }) =>
          `  - ${validationError.feature}: ${validationError.missing.join(", ")}`
      )
      .join("\n");

    console.error(
      `❌ Environment validation failed:\n${message}\n\nSet the required environment variables and check your app configuration.`
    );
    return true;
  }

  return false;
};
