const hasText = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const nonEmptyText = (value: string | null | undefined): string | undefined =>
  hasText(value) ? value : undefined;

export { hasText, nonEmptyText };
