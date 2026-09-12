import { WithSkeleton } from "@/components/with-skeleton";

const Loading = () => (
  <WithSkeleton className="h-full w-full" isLoading={true}>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

export default Loading;
