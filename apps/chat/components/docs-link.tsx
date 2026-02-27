import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const DOCS_URL = "https://chatjs.dev/docs";

export function DocsLink() {
	return (
		<Button asChild size="icon" type="button" variant="ghost">
			<a
				aria-label="Open documentation"
				className="flex items-center justify-center"
				href={DOCS_URL}
				rel="noopener noreferrer"
				target="_blank"
			>
				<BookOpen size={20} />
			</a>
		</Button>
	);
}
