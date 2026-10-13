import { useSignedUrls } from "@/lib/data";
import { cn } from "@/lib/utils";

export function PhotoThumb({ path, className, alt = "" }: { path: string; className?: string; alt?: string }) {
  const { data } = useSignedUrls([path]);
  const url = data?.[path];
  return url ? (
    <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />
  ) : (
    <div className={cn("animate-pulse bg-muted", className)} />
  );
}
