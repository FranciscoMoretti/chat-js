"use client";

import { useId } from "react";
import type { SvgDrawing } from "../../lib/author-svg-contract";

export default function SvgRenderer({ output }: { output: SvgDrawing }) {
	const titleId = useId();
	return (
		<figure>
			<svg
				viewBox="0 0 512 512"
				role="img"
				aria-labelledby={titleId}
				style={{ width: "100%", maxWidth: 512, background: "#f5f5f5" }}
			>
				<title id={titleId}>{output.title}</title>
				{output.shapes.map((shape, index) =>
					shape.kind === "circle" ? (
						<circle
							key={`${index}-${shape.kind}`}
							cx={shape.x}
							cy={shape.y}
							r={shape.radius}
							fill={shape.fill}
						/>
					) : (
						<rect
							key={`${index}-${shape.kind}`}
							x={shape.x}
							y={shape.y}
							width={shape.width}
							height={shape.height}
							fill={shape.fill}
						/>
					),
				)}
			</svg>
			<figcaption>{output.title}</figcaption>
		</figure>
	);
}
