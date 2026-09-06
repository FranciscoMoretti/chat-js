import type { ReactNode } from "react";

/** The pinned generated app passes its existing Chat element as children. */
export function StudioLayout({ children }: { children: ReactNode }) {
	return (
		<div>
			<div
				style={{
					padding: "16px 24px",
					background: "#e8f0eb",
					borderBottom: "1px solid #b8c7bd",
				}}
			>
				<strong>Independent author studio</strong>
				<p style={{ margin: "8px 0 0" }}>
					An external layout around your conversation.
				</p>
			</div>
			{children}
		</div>
	);
}
