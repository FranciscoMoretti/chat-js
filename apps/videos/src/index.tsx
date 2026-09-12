import { Composition, registerRoot } from "remotion";

import { BrandExample } from "./brand-example";
import { DURATION, FPS, script } from "./story";
import { ThreadsLaunch } from "./threads-launch";

const Root = () => (
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
registerRoot(Root);
