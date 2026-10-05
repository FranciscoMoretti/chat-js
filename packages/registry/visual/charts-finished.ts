import { getInstanceByDom } from "echarts";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (chartsFinished); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
