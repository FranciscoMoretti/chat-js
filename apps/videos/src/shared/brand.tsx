import { loadFont } from "@remotion/fonts";
import { Img, staticFile } from "remotion";

loadFont({
	family: "Geist",
	url: staticFile("brand/geist-latin.woff2"),
	weight: "100 900",
});
loadFont({
	family: "Geist Mono",
	url: staticFile("brand/geist-mono-latin.woff2"),
	weight: "100 900",
});
export function Logo() {
	return <Img src={staticFile("brand/chatjs-logo.svg")} alt="ChatJS" />;
}
