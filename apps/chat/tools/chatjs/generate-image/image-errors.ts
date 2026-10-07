// oxlint-disable-next-line eslint/no-undefined -- Undefined is the actual missing optional diagnostic property value; preserve explicit name/constructor absence when serializing arbitrary SDK errors.
const ABSENT_DIAGNOSTIC_VALUE = undefined;

const serializeError = (
  error: unknown
): { name?: string; message: string; stack?: string; raw?: unknown } => {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  if (typeof error === "object" && error !== null && "then" in error) {
    return { message: "Error was a Promise - check raw", raw: error };
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message);
    const hasName = Boolean(Reflect.get(error, "name"));
    // oxlint-disable-next-line no-ternary -- Keep name as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const name: unknown = hasName
      ? Reflect.get(error, "name")
      : ABSENT_DIAGNOSTIC_VALUE;
    // oxlint-disable-next-line no-ternary -- Keep name as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    return { message, name: hasName ? String(name) : ABSENT_DIAGNOSTIC_VALUE };
  }
  return { message: String(error), raw: error };
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveError's awaited sequencing and rejected-Promise behavior. */
const resolveError = async (thrownValue: unknown): Promise<unknown> => {
  if (
    typeof thrownValue === "object" &&
    thrownValue !== null &&
    "then" in thrownValue
  ) {
    try {
      return await Promise.resolve(thrownValue);
    } catch (resolvedError) {
      return resolvedError;
    }
  }
  return thrownValue;
};
/* oxlint-enable oxc/no-async-await */
const constructorName = (value: unknown): unknown => {
  if (value === null || value === ABSENT_DIAGNOSTIC_VALUE) {
    return ABSENT_DIAGNOSTIC_VALUE;
  }
  const constructor: unknown = Reflect.get(new Object(value), "constructor");
  if (constructor === null || constructor === ABSENT_DIAGNOSTIC_VALUE) {
    return ABSENT_DIAGNOSTIC_VALUE;
  }
  return Reflect.get(new Object(constructor), "name");
};
const getErrorDebugInfo = (
  error: unknown
): { errorConstructor: unknown; errorKeys: string[]; errorType: string } => ({
  errorConstructor: constructorName(error),
  errorKeys:
    // oxlint-disable-next-line no-ternary -- Keep errorKeys as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    typeof error === "object" && error !== null ? Object.keys(error) : [],
  errorType: typeof error,
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (serializeError, resolveError, getErrorDebugInfo, ABSENT_DIAGNOSTIC_VALUE); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  serializeError,
  resolveError,
  getErrorDebugInfo,
  ABSENT_DIAGNOSTIC_VALUE,
};
/* oxlint-enable import/no-named-export */
