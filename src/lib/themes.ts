// Accent palettes. Applied as CSS variable overrides on <html>; dark/light stays separate.
export type Accent = { id: string; name: string; l: number; c: number; h: number };
type Oklch = [number, number, number];

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
  { id: "noel", name: "Giáng sinh", l: 0.64, c: 0.2, h: 25 },
];

const css = ([l, c, h]: Oklch) => `oklch(${l} ${+c.toFixed(3)} ${h})`;
export const accentColor = (a: Accent) => css([a.l, a.c, a.h]);

// Page backgrounds — must mirror src/styles.css (:root dark, .light).
const BG: Record<"dark" | "light", { bg: Oklch; surface: Oklch }> = {
  dark: { bg: [0.17, 0.006, 260], surface: [0.22, 0.008, 260] },
  light: { bg: [0.97, 0.004, 260], surface: [1, 0, 0] },
};

const DARK_FG: Oklch = [0.2, 0.02, 260];
const WHITE: Oklch = [0.99, 0, 0];

/** Tunes accent lightness per mode so it reads on the page (≥4.5), then picks the better button text colour. */
export function accentTokens(a: Accent, light: boolean) {
  const bg = BG[light ? "light" : "dark"].bg;
  let L = light && a.id === "mono" ? 0.3 : a.l;
  const at = (l: number): Oklch => [+l.toFixed(3), a.c, a.h];
  const step = light ? -0.01 : 0.01;
  for (let i = 0; i < 40 && contrast(at(L), bg) < 4.5; i++) L += step;
  const main = at(L);
  const fg = contrast(main, WHITE) >= contrast(main, DARK_FG) ? WHITE : DARK_FG;
  return { main, fg };
}

/** WCAG relative luminance of an OKLCH colour (via OKLab → linear sRGB). */
export function luminance([L, C, H]: Oklch) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const cl = (v: number) => Math.min(1, Math.max(0, v));
  const R = cl(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const G = cl(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const B = cl(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
export function contrast(x: Oklch, y: Oklch) {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
}

export type ContrastIssue = { mode: "dark" | "light"; what: string; ratio: number; need: number };

/** Checks: button text on accent (4.5), accent text on page (4.5), chart bars on page/card (3). */
export function checkAccent(a: Accent): ContrastIssue[] {
  const out: ContrastIssue[] = [];
  for (const mode of ["dark", "light"] as const) {
    const { main, fg } = accentTokens(a, mode === "light");
    const { bg, surface } = BG[mode];
    const checks: [string, number, number][] = [
      ["Chữ trên nút", contrast(main, fg), 4.5],
      ["Chữ màu chủ đạo", contrast(main, bg), 4.5],
      ["Cột biểu đồ", Math.min(contrast(main, bg), contrast(main, surface)), 3],
    ];
    for (const [what, ratio, need] of checks) if (ratio < need) out.push({ mode, what, ratio, need });
  }
  return out;
}

export function applyAccent(id: string | undefined, light: boolean) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  document.documentElement.classList.toggle("noel", a.id === "noel");
  const s = document.documentElement.style;
  const { main: m, fg: f } = accentTokens(a, light);
  const main = css(m), fg = css(f);
  const tint = (bgL: number, cMul: number) => `oklch(${bgL} ${(a.c * cMul).toFixed(3)} ${a.h})`;
  for (const k of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--chart-1"]) s.setProperty(k, main);
  s.setProperty("--primary-foreground", fg);
  s.setProperty("--accent", light ? tint(0.92, 0.25) : tint(0.3, 0.25));
  s.setProperty("--accent-foreground", light ? tint(0.35, 0.7) : tint(0.9, 0.4));
}

// ---- Fonts (all with Vietnamese glyph support on Google Fonts) ----
export type Font = { id: string; name: string; family: string; fallback: "sans-serif" | "serif" | "monospace" };
export const FONTS: Font[] = [
  { id: "jakarta", name: "Plus Jakarta Sans", family: "Plus Jakarta Sans", fallback: "sans-serif" },
  { id: "be-vietnam", name: "Be Vietnam Pro", family: "Be Vietnam Pro", fallback: "sans-serif" },
  { id: "lexend", name: "Lexend", family: "Lexend", fallback: "sans-serif" },
  { id: "inter", name: "Inter", family: "Inter", fallback: "sans-serif" },
  { id: "manrope", name: "Manrope", family: "Manrope", fallback: "sans-serif" },
  { id: "montserrat", name: "Montserrat", family: "Montserrat", fallback: "sans-serif" },
  { id: "nunito", name: "Nunito", family: "Nunito", fallback: "sans-serif" },
  { id: "quicksand", name: "Quicksand", family: "Quicksand", fallback: "sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk", fallback: "sans-serif" },
  { id: "work-sans", name: "Work Sans", family: "Work Sans", fallback: "sans-serif" },
  { id: "epilogue", name: "Epilogue", family: "Epilogue", fallback: "sans-serif" },
  { id: "mulish", name: "Mulish", family: "Mulish", fallback: "sans-serif" },
  { id: "playfair", name: "Playfair Display", family: "Playfair Display", fallback: "serif" },
  { id: "merriweather", name: "Merriweather", family: "Merriweather", fallback: "serif" },
  { id: "lora", name: "Lora", family: "Lora", fallback: "serif" },
  { id: "cormorant", name: "Cormorant Garamond", family: "Cormorant Garamond", fallback: "serif" },
  { id: "jetbrains", name: "JetBrains Mono", family: "JetBrains Mono", fallback: "monospace" },
  { id: "roboto-mono", name: "Roboto Mono", family: "Roboto Mono", fallback: "monospace" },
  { id: "fira-code", name: "Fira Code", family: "Fira Code", fallback: "monospace" },
  { id: "cabin", name: "Cabin", family: "Cabin", fallback: "sans-serif" },
];

const fontHref = (f: Font) =>
  `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, "+")}:wght@400;500;600;700&display=swap&subset=vietnamese`;

/** Lazily inject a font stylesheet once (browser only). */
export function loadFont(f: Font) {
  const id = `font-${f.id}`;
  if (f.id === "jakarta" || document.getElementById(id)) return;
  const link = document.createElement("link");
  Object.assign(link, { id, rel: "stylesheet", href: fontHref(f) });
  document.head.appendChild(link);
}

export function applyFont(id: string | undefined) {
  const f = FONTS.find((x) => x.id === id) ?? FONTS[0];
  loadFont(f);
  document.documentElement.style.setProperty("--font-sans", `"${f.family}", ui-${f.fallback === "monospace" ? "monospace" : f.fallback}, ${f.fallback}`);
}
