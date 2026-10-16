import { useSignedUrls } from "@/lib/data";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PhotoThumb({ path, className, alt = "" }: { path: string; className?: string; alt?: string }) {
  const { data } = useSignedUrls([path], true);
  const url = data?.[path];
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn("relative overflow-hidden", className, !loaded && "shimmer bg-surface-2")}>
      {url && (
        <img src={url} alt={alt} loading="lazy" onLoad={() => setLoaded(true)}
          className={cn("size-full object-cover transition-[opacity,filter] duration-200", loaded ? "opacity-100 blur-0" : "opacity-0 blur-sm")} />
      )}
    </div>
  );
}
