"use client";
import type { ComponentType } from "react";
import { renderers } from "../../chat.client";
import type { ProjectMessage } from "../../lib/projection";

const installed: Readonly<Record<string, ComponentType<{ value: unknown }>>> =
	renderers;
export function ToolResults({ parts }: { parts: ProjectMessage["parts"] }) {
	return parts.map((part) => {
		if (part.type !== "dynamic-tool") return null;
		const Renderer = Object.hasOwn(installed, part.toolName)
			? installed[part.toolName]
			: undefined;
		return (
			<section key={part.toolCallId} aria-label={`Tool ${part.toolName}`}>
				<p>
					{part.toolName}: {part.state}
				</p>
				{part.state === "output-available" && Renderer ? (
					<Renderer value={part.output} />
				) : null}
			</section>
		);
	});
}
