"use client";

import { svgOutput } from "../../lib/author-svg-contract";
import { toolRenderer } from "../../lib/tool-renderer";

export const SvgResult = toolRenderer(svgOutput, () => import("./renderer"));
