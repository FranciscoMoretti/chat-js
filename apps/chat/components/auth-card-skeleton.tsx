import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AuthCardSkeletonProps = {
  title: string;
  description: string;
  className?: string;
  contentClassName?: string;
  variant?: "form" | "device";
};

export function AuthCardSkeleton({
  title,
  description,
  className,
  contentClassName,
  variant = "form",
}: AuthCardSkeletonProps) {
  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Card className={contentClassName}>
        <CardHeader className="text-center">
          <h1 className="font-semibold text-xl leading-none">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {variant === "device" ? (
              <>
                <Skeleton className="mx-auto size-10 rounded-full" />
                <Skeleton className="mx-auto h-4 w-56" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="mx-auto h-4 w-40" />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
