import { getInstanceByDom } from "echarts";

export const chartsFinished = (container: HTMLElement) => {
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
