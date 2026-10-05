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
    const name: unknown = hasName
      ? Reflect.get(error, "name")
      : ABSENT_DIAGNOSTIC_VALUE;
    return { message, name: hasName ? String(name) : ABSENT_DIAGNOSTIC_VALUE };
  }
  return { message: String(error), raw: error };
};
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
    typeof error === "object" && error !== null ? Object.keys(error) : [],
  errorType: typeof error,
});
export {
  serializeError,
  resolveError,
  getErrorDebugInfo,
  ABSENT_DIAGNOSTIC_VALUE,
};
