// Accent palettes. Applied as CSS variable overrides on <html>; dark/light stays separate.
export type Accent = { id: string; name: string; l: number; c: number; h: number };

export const ACCENTS: Accent[] = [
  { id: "ocean", name: "Đại dương", l: 0.66, c: 0.17, h: 252 },
  { id: "violet", name: "Tím", l: 0.64, c: 0.2, h: 295 },
  { id: "rose", name: "Hồng", l: 0.66, c: 0.2, h: 350 },
  { id: "emerald", name: "Ngọc lục", l: 0.7, c: 0.16, h: 160 },
  { id: "amber", name: "Hổ phách", l: 0.78, c: 0.16, h: 75 },
  { id: "coral", name: "San hô", l: 0.7, c: 0.17, h: 35 },
  { id: "teal", name: "Xanh mòng két", l: 0.7, c: 0.12, h: 195 },
  { id: "indigo", name: "Chàm", l: 0.58, c: 0.2, h: 272 },
  { id: "lime", name: "Chanh", l: 0.8, c: 0.18, h: 128 },
  { id: "mono", name: "Đơn sắc", l: 0.8, c: 0, h: 260 },
];

export const accentColor = (a: Accent) => `oklch(${a.l} ${a.c} ${a.h})`;

export function applyAccent(id: string | undefined, light: boolean) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const s = document.documentElement.style;
  const main = light && a.id === "mono" ? "oklch(0.3 0 0)" : accentColor(a);
  const fg = a.l >= 0.75 && !(light && a.id === "mono") ? "oklch(0.2 0.02 260)" : "oklch(0.99 0 0)";
  const tint = (bgL: number, cMul: number) => `oklch(${bgL} ${(a.c * cMul).toFixed(3)} ${a.h})`;
  s.setProperty("--primary", main);
  s.setProperty("--ring", main);
  s.setProperty("--sidebar-primary", main);
  s.setProperty("--sidebar-ring", main);
  s.setProperty("--chart-1", main);
  s.setProperty("--primary-foreground", fg);
  s.setProperty("--accent", light ? tint(0.92, 0.25) : tint(0.3, 0.25));
  s.setProperty("--accent-foreground", light ? tint(0.35, 0.7) : tint(0.9, 0.4));
}
