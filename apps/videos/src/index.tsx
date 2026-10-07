import React from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Composition, registerRoot } from "remotion";
/* oxlint-enable sort-imports */

import { BrandExample } from "./brand-example";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { DURATION, FPS, script } from "./story";
/* oxlint-enable sort-imports */
import { ThreadsLaunch } from "./threads-launch";

/* oxlint-disable react/only-export-components -- Root: The route/scene module exports metadata or helpers required alongside its component by existing consumers. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Root: The prop object depends on current render/scene state; memoization needs lifecycle/dependency review and an identity-sensitive consumer. */
const Root = (): React.JSX.Element => (
  <>
    <Composition
      id="BrandExample"
      component={BrandExample}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={90}
    />
    <Composition
      id="ThreadsLaunch"
      component={ThreadsLaunch}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={DURATION * FPS}
      defaultProps={{ content: script }}
    />
  </>
);
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/only-export-components */
registerRoot(Root);
