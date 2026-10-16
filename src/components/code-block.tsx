import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Read-only monospace block with a copy button (docs, prompts, cURL). */
export function CodeBlock({ code, label, className, maxHeight = "max-h-80" }: { code: string; label?: string; className?: string; maxHeight?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setDone(true);
    toast.success("Đã sao chép");
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-surface-2", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{label ?? "code"}</span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label="Sao chép">
          {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? "Đã chép" : "Chép"}
        </Button>
      </div>
      <pre className={cn("overflow-auto p-3 text-xs leading-relaxed", maxHeight)}><code>{code}</code></pre>
    </div>
  );
}
