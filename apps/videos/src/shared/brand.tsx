import { loadFont } from "@remotion/fonts";
import { Img, staticFile } from "remotion";

void loadFont({
  family: "Geist",
  url: staticFile("brand/geist-latin.woff2"),
  weight: "100 900",
});
void loadFont({
  family: "Geist Mono",
  url: staticFile("brand/geist-mono-latin.woff2"),
  weight: "100 900",
});
export const Logo = () => (
  <Img src={staticFile("brand/chatjs-logo.svg")} alt="ChatJS" />
);
