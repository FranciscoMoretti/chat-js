import type { ReactNode } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

// Optional content controls surrounding chrome using the historical falsy
// cases, including numeric children that React itself renders.
const hasCustomContent = <Value extends ReactNode | ReadonlyReactNode>(
  value: Value
): value is Exclude<Value, false | null | undefined> =>
  value !== null &&
  value !== undefined &&
  value !== false &&
  value !== "" &&
  value !== 0 &&
  value !== 0n &&
  !(typeof value === "number" && Number.isNaN(value));

export { hasCustomContent };
