const isJsonObject = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && Boolean(value) && !Array.isArray(value);

const jsonObject = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object");
  }
  return value;
};

const jsonArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected a JSON array");
  }
  return value;
};

const parseJsonObject = (source: string): Readonly<Record<string, unknown>> => {
  const value: unknown = JSON.parse(source);
  return jsonObject(value);
};

const jsonString = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new TypeError("Expected a JSON string");
  }
  return value;
};

export { jsonObject, jsonArray, jsonString, parseJsonObject };
