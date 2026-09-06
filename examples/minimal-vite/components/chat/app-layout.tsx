import type { ComponentType, ReactNode } from "react";
import { Chat } from "../../app/chat";
import SelectedLayout from "../../components/chat/layout-minimal";

const Layout: ComponentType<{ children: ReactNode }> = SelectedLayout;
export default function AppLayout() {
	return (
		<Layout>
			<Chat />
		</Layout>
	);
}
