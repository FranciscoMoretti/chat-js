import type { ReactNode } from "react";
import "./style.css";
export const metadata = { title: "ChatJS · Minimal conversation" };
export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
