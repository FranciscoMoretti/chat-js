import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack";

Config.overrideWebpackConfig(webpackOverride);
