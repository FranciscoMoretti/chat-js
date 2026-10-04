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

const taskList = (
  source: string
): readonly Readonly<Record<string, unknown>>[] =>
  jsonArray(parseJsonObject(source).tasks).map((item) => jsonObject(item));

const findTask = (
  tasks: readonly Readonly<Record<string, unknown>>[],
  taskId: string
): Readonly<Record<string, unknown>> => {
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) {
    throw new Error(`Missing Turbo task: ${taskId}`);
  }
  return task;
};

interface TaskPlan {
  readonly tasks: readonly Readonly<Record<string, unknown>>[];
}

const parseAffectedTaskNames = (source: string): readonly string[] => {
  const data = jsonObject(parseJsonObject(source).data);
  const affectedTasks = jsonObject(data.affectedTasks);
  return jsonArray(affectedTasks.items).map((item) =>
    jsonString(jsonObject(item).fullName)
  );
};

export {
  jsonObject,
  jsonArray,
  jsonString,
  parseJsonObject,
  taskList,
  findTask,
  parseAffectedTaskNames,
};
export type { TaskPlan };
