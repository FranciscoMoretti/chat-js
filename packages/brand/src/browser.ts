import { markSvg } from "./identity";
import { squareSvg } from "./square";

let serial = 0;

// The standalone hero and source animation share these two small entry points.
Object.assign(globalThis, {
  CarbonMotion: { mark: markSvg },
  CarbonSquare: {
    svg(name: string, meta: string, index: number) {
      serial += 1;
      return squareSvg(name, meta, index, `square-fade-${serial}`);
    },
  },
});
