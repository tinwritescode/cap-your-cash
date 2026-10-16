import { Check, Snowflake, TriangleAlert } from "lucide-react";
import { ACCENTS, FONTS, accentColor, checkAccent, loadFont } from "@/lib/themes";

/** Round accent swatches, one per theme. The Christmas theme gets a red/green swatch with a snowflake. */
export function AccentSwatches({ value, light, onChange }: { value: string | undefined; light: boolean; onChange: (id: string) => void }) {
  const current = ACCENTS.find((x) => x.id === (value ?? "ocean")) ?? ACCENTS[0];
  const issues = checkAccent(current);
  const mode = light ? "light" : "dark";
  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        {ACCENTS.map((a) => {
          const on = (value ?? "ocean") === a.id;
          const warn = checkAccent(a).length > 0;
          const noel = a.id === "noel";
          return (
            <button key={a.id} aria-label={a.name + (warn ? " (độ tương phản thấp)" : "")} aria-pressed={on} title={a.name} onClick={() => onChange(a.id)}
              className={`relative mx-auto grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface ${on ? "ring-2 ring-foreground" : ""}`}
              style={noel ? { background: "linear-gradient(135deg, oklch(0.55 0.2 25) 50%, oklch(0.45 0.12 150) 50%)" } : { background: accentColor(a) }}>
              {noel ? <Snowflake className="size-4 text-background" /> : null}
              {!noel && on && <Check className="size-4 text-background" />}
              {warn && <span aria-hidden className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-foreground text-background text-[10px] font-bold">!</span>}
            </button>
          );
        })}
      </div>
      {issues.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">✓ “{current.name}” dễ đọc ở cả chế độ sáng và tối.</p>
      ) : (
        <div role="status" className="mt-3 rounded-2xl border border-border bg-surface-2 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4" /> “{current.name}” có thể khó đọc</p>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-muted-foreground">
            {issues.map((i, k) => (
              <li key={k} className={i.mode === mode ? "text-foreground" : ""}>
                Chế độ {i.mode === "light" ? "sáng" : "tối"}{i.mode === mode ? " (đang dùng)" : ""} · {i.what}: {i.ratio.toFixed(1)}:1 (cần {i.need}:1)
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Compact wrap of font chips, each rendered in its own font (loaded on hover/focus). */
export function FontChips({ value, onChange }: { value: string | undefined; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FONTS.map((f) => {
        const on = (value ?? "jakarta") === f.id;
        return (
          <button key={f.id} aria-pressed={on} onClick={() => onChange(f.id)}
            onPointerEnter={() => loadFont(f)} onFocus={() => loadFont(f)}
            className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-surface-2"}`}
            style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
