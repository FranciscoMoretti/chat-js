const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonObject = (source: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(source);
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }
  return value;
};

export { isJsonObject, parseJsonObject };
