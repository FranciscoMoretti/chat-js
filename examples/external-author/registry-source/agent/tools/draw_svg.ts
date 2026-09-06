import { defineTool } from "eve/tools";
import { type SvgDrawing, svgOutput } from "../../lib/author-svg-contract";

export default defineTool({
	description:
		"Draw a small SVG illustration using up to 32 circles and rectangles on a 512 by 512 canvas. Return structured shapes, never SVG markup.",
	inputSchema: svgOutput,
	async execute(input): Promise<SvgDrawing> {
		return svgOutput.parse(input);
	},
});
