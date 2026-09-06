import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { type SvgDrawing, svgOutput } from "../../lib/author-svg-contract";

export default defineTool({
	description:
		"Draw a small SVG illustration using up to 32 circles and rectangles on a 512 by 512 canvas. Requires explicit owner approval. Return structured shapes, never SVG markup.",
	inputSchema: svgOutput,
	approval: {
		request: always(),
		response: ({ responder, session }) =>
			responder.principalId === session.initiator?.principalId
				? { status: "allowed" }
				: { status: "rejected", reason: "Only the owner may respond" },
	},
	async execute(input): Promise<SvgDrawing> {
		return svgOutput.parse(input);
	},
});
