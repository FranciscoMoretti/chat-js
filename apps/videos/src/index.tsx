import { Composition, registerRoot } from "remotion";
import { BrandExample } from "./BrandExample";

function Root() {
	return (
		<Composition
			id="BrandExample"
			component={BrandExample}
			width={1920}
			height={1080}
			fps={30}
			durationInFrames={90}
		/>
	);
}
registerRoot(Root);
