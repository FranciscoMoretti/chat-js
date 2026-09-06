import { z } from "zod";

const coordinate = z.number().finite().min(0).max(512);
const color = z.enum(["black", "white", "red", "blue", "green", "orange"]);
const shape = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("circle"),
		x: coordinate,
		y: coordinate,
		radius: z.number().finite().min(1).max(256),
		fill: color,
	}),
	z.strictObject({
		kind: z.literal("rectangle"),
		x: coordinate,
		y: coordinate,
		width: z.number().finite().min(1).max(512),
		height: z.number().finite().min(1).max(512),
		fill: color,
	}),
]);

// SVG is produced from structured data; raw markup, URLs and event handlers
// are deliberately outside this drawing tool's contract.
export const svgOutput = z.strictObject({
	title: z.string().min(1).max(120),
	shapes: z.array(shape).min(1).max(32),
});
export type SvgDrawing = z.output<typeof svgOutput>;
