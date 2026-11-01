export type FormatSource = (input: {
  readonly path: string;
  readonly source: string;
}) => string | null | Promise<string | null>;

export type SourceComparison =
  | { readonly status: "unchanged" | "formatting-only" }
  | {
      readonly status: "modified";
      readonly formatting:
        | "different"
        | "unavailable"
        | "unsupported"
        | "failed";
    };

/** Compare installed text without loading files, executing configuration, or changing source. */
export const compareRegistrySource = async ({
  path,
  baseline,
  local,
  formatSource,
}: {
  readonly path: string;
  readonly baseline: string;
  readonly local: string;
  readonly formatSource?: FormatSource;
}): Promise<SourceComparison> => {
  if (baseline === local) {
    return { status: "unchanged" };
  }
  if (!formatSource) {
    return { status: "modified", formatting: "unavailable" };
  }
  // Drain both calls even if one fails; hooks must not outlive the comparison.
  const results = await Promise.allSettled(
    [baseline, local].map(
      async (source) => await formatSource({ path, source })
    )
  );
  if (results.some((result) => result.status === "rejected")) {
    return { status: "modified", formatting: "failed" };
  }
  const formatted = results.map((result) =>
    result.status === "fulfilled" ? result.value : null
  );
  if (formatted.some((source) => source === null)) {
    return { status: "modified", formatting: "unsupported" };
  }
  // Hooks can come from untyped project JavaScript. Invalid results never imply equality.
  if (formatted.some((source) => typeof source !== "string")) {
    return { status: "modified", formatting: "failed" };
  }
  return formatted[0] === formatted[1]
    ? { status: "formatting-only" }
    : { status: "modified", formatting: "different" };
};
