import { expect, test } from "vitest";

import { codeExecutionResult } from "./code-execution.schemas";

test.each(["line", "scatter"])(
  "Python %s charts accept a None numeric axis",
  (type) => {
    const result = codeExecutionResult.parse({
      message: "retained output",
      chart: {
        type,
        title: "Numeric",
        x_scale: null,
        elements: [{ label: "Series", points: [[1, 2]] }],
      },
    });
    expect(result.message).toBe("retained output");
    expect(result.chart).toMatchObject({ type, x_scale: undefined });
  }
);
