import { InternalLink } from "@/components/internal-link";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="bg-background min-h-screen">
    <div className="container mx-auto p-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="text-foreground text-4xl font-semibold">404</h1>
          <h2 className="text-muted-foreground text-xl">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild>
            <InternalLink href="/">Return Home</InternalLink>
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export default NotFound;
