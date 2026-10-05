const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  // oxlint-disable-next-line unicorn/no-null -- JSON null is a value, but cannot hold the properties these configuration transforms edit.
  value !== null &&
  !Array.isArray(value);

const requireJsonObject = (
  value: unknown,
  description: string
): Record<string, unknown> => {
  if (!isJsonObject(value)) {
    throw new TypeError(`${description} must be a JSON object.`);
  }
  return value;
};

const parseJsonObject = (
  source: string,
  description: string
): Record<string, unknown> => {
  const value: unknown = JSON.parse(source);
  return requireJsonObject(value, description);
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item: unknown) => typeof item === "string");

export { isJsonObject, isStringArray, parseJsonObject, requireJsonObject };
