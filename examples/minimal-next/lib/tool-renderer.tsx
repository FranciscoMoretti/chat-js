"use client";
import {
	Component,
	type ComponentType,
	lazy,
	type ReactNode,
	Suspense,
} from "react";
import type { z } from "zod";

class RendererBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? (
			<p>Tool result unavailable.</p>
		) : (
			this.props.children
		);
	}
}

// The output type comes from the same browser-safe schema used by the tool.
export function toolRenderer<S extends z.ZodType>(
	schema: S,
	load: () => Promise<{ default: ComponentType<{ output: z.output<S> }> }>,
) {
	const Renderer = lazy(load);
	return function ValidatedResult({ value }: { value: unknown }) {
		const result = schema.safeParse(value);
		if (!result.success) return <p>Tool result unavailable.</p>;
		return (
			<RendererBoundary>
				<Suspense fallback={<p>Loading tool result…</p>}>
					<Renderer output={result.data} />
				</Suspense>
			</RendererBoundary>
		);
	};
}
