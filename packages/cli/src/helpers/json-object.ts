const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
