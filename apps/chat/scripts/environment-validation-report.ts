const EMPTY_DIAGNOSTIC_COUNT = 0;

const formatGatewaySnapshotWarning = (
  generatedForGateway: string,
  configuredGateway: string
): string =>
  `models.generated.ts was built for "${generatedForGateway}" but config uses "${configuredGateway}". Run \`bun fetch:models\` to update the fallback snapshot.`;

const reportEnvironmentFailure = (
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

const reportEnvironmentSuccess = (snapshotWarning: string | null): void => {
  if (snapshotWarning !== null) {
    console.warn(`⚠️  ${snapshotWarning}`);
  }

  console.log("✅ Environment validation passed");
};
export {
  formatGatewaySnapshotWarning,
  reportEnvironmentFailure,
  reportEnvironmentSuccess,
};
