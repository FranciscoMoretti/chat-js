import { getInstanceByDom } from "echarts";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const chartsFinished = (container: HTMLElement): boolean => {
  const charts = container.querySelectorAll<HTMLElement>(
    "[_echarts_instance_]"
  );
  return (
    charts.length > 0 &&
    [...charts].every((element) =>
      getInstanceByDom(element)?.getZr().animation.isFinished()
    )
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
