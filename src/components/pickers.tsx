import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { vi } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const NONE = "__none__";
export type Opt = { value: string; label: string };

/** Styled select. Empty string "" is allowed as a value (mapped to a sentinel internally). */
export function AppSelect({ value, onChange, options, placeholder, className, ...a }: {
  value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; className?: string; "aria-label"?: string;
}) {
  return (
    <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className={cn("field", className)} aria-label={a["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-2xl">
        {options.map((o) => (
          <SelectItem key={o.value || NONE} value={o.value || NONE} className="min-h-10 rounded-xl">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const label = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

/** Date picker for "YYYY-MM-DD" strings ("" = empty). */
export function DatePicker({ value, onChange, placeholder = "Chọn ngày", clearable, className, ...a }: {
  value: string; onChange: (v: string) => void; placeholder?: string; clearable?: boolean; className?: string; "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={a["aria-label"]} className={cn("field flex items-center gap-2 text-left", !value && "text-muted-foreground", className)}>
          <CalendarDays className="size-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{value ? label(value) : placeholder}</span>
          {clearable && value && (
            <span role="button" aria-label="Xoá ngày" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="-mr-1 grid size-6 place-items-center rounded-full hover:bg-surface-2"><X className="size-3.5" /></span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-2xl p-0" align="start">
        <Calendar mode="single" locale={vi} selected={value ? fromYmd(value) : undefined}
          defaultMonth={value ? fromYmd(value) : undefined}
          onSelect={(d) => { if (d) { onChange(toYmd(d)); setOpen(false); } }} className="rounded-2xl" />
      </PopoverContent>
    </Popover>
  );
}

/** Date + time for "YYYY-MM-DDTHH:mm" strings. */
export function DateTimePicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [d, t] = value ? value.split("T") : ["", "00:00"];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
      <DatePicker value={d} onChange={(nd) => onChange(`${nd}T${t || "00:00"}`)} aria-label="Ngày" className="min-w-0" />
      <input id={id} type="time" aria-label="Giờ" value={(t || "").slice(0, 5)} onChange={(e) => onChange(`${d}T${e.target.value}`)} className="field min-w-0 text-center" />
    </div>
  );
}
