/* oxlint-disable no-console -- These CLI reporting operations emit ordered environment diagnostics, the gateway warning and validation success through console. */
const reportEnvironmentFailure = (
  errors: readonly {
    readonly feature: string;
    readonly missing: readonly string[];
  }[]
): boolean => {
  // oxlint-disable-next-line no-magic-numbers -- Zero distinguishes an empty diagnostic list from validation failures.
  if (errors.length > 0) {
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

const reportEnvironmentSuccess = (snapshotWarning: string | null): void => {
  if (snapshotWarning !== null) {
    console.warn(`⚠️  ${snapshotWarning}`);
  }

  console.log("✅ Environment validation passed");
};
/* oxlint-enable no-console */
/* oxlint-disable import/no-named-export -- The CLI imports these named reporting operations; app guidance and enabled import/no-default-export require named exports. */
export { reportEnvironmentFailure, reportEnvironmentSuccess };
/* oxlint-enable import/no-named-export */
