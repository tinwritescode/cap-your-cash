import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn("shimmer rounded-md bg-surface-2", className)} {...props} />
  );
}

export { Skeleton };
