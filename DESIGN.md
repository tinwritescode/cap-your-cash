# CapMoney — Design System (reverse-engineered)

This file describes the app as it is rendered today. It is a record, not a redesign. If code and this file disagree, the current rendered UI wins; update this file to match.

---

## 1. Direction and principles

- **Personality:** a calm, private, photo-first money diary. The feeling should be "a camera app like Locket that also counts money", not a banking dashboard.
- **Look:** charcoal dark by default (light mode is optional), with soft rounded surfaces, flat form fields and **bubbly pill buttons**. Colour is used rarely: the accent colour, plus red for spending and green for income.
- **Mobile first:** one column, max width `max-w-3xl`, a floating glass bottom nav, a floating round FAB and safe-area padding everywhere. Desktop adds a left sidebar.
- **Photos are the hero:** square crops, big rounded corners, thumbnails inside calendar cells.
- **Online only:** no offline cache. When offline, a full-page message replaces the content (`Offline` in `src/components/shell.tsx`).
- Vietnamese copy, VND amounts, tabular numbers (`font-feature-settings: "tnum"` on `body`).

## 2. Colour tokens

Source: `src/styles.css` (`:root` = dark default, `.light` = light). Components use semantic Tailwind classes only (`bg-surface`, `text-expense` …). Never use raw colours like `text-white`, `bg-black` or `bg-[#...]`.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | oklch(0.17 0.006 260) | oklch(0.97 0.004 260) | page |
| surface | oklch(0.22 0.008 260) | oklch(1 0 0) | cards, segmented track |
| surface-2 | oklch(0.27 0.01 260) | oklch(0.94 0.006 260) | fields, inner tiles, hover rows, skeleton |
| foreground | 0.97 | 0.2 | text |
| muted-foreground | 0.68 | 0.48 | secondary text |
| primary | accent (default ocean oklch(0.66 0.17 252)) | auto-tuned | buttons, active states, today |
| accent / accent-foreground | tinted primary | tinted primary | round icon buttons |
| expense | oklch(0.68 0.19 22) | oklch(0.58 0.2 25) | spending amounts |
| income | oklch(0.76 0.17 150) | oklch(0.55 0.15 150) | income amounts |
| destructive | oklch(0.64 0.2 25) | same | delete, sign-out text |
| border | white 8% | black 9% | hairlines |
| input | white 12% | black 14% | (legacy) |
| overlay | oklch(0.12 … / 0.62) | — | scrims over photos |
| chart-1..5 | chart-1 = primary | — | Recharts |

- **Accent themes:** 10 palettes in `src/lib/themes.ts` (`ACCENTS`), applied at runtime by `applyAccent()` through `src/lib/ui-prefs.tsx`. Their contrast is auto-tuned to 4.5:1 (`accentTokens`, `checkAccent`). The `BG` constants there must mirror `src/styles.css`.
  - Correct: `className="bg-primary text-primary-foreground"`.
  - Incorrect: `style={{ background: "#3B82F6" }}`.
- **Amount colours:** spending is `text-expense`, income is `text-income`. The "spent today" chip uses `bg-destructive/15 text-expense` (`src/routes/_authenticated/index.tsx`).

## 3. Typography

- Family: `--font-sans` = "Plus Jakarta Sans" (loaded in `src/routes/__root.tsx`, weights 400–800). Users can switch between 20 fonts (`FONTS`, `applyFont`).
- Scale in use: page title `text-2xl font-bold` (`PageHeader`); home name `text-3xl font-bold`; card amount `text-lg font-bold`; composer amount input `text-3xl font-bold`; body `text-sm` / `text-base`; meta `text-xs text-muted-foreground`; nav labels `text-[10px]`; badges `text-[10px] font-semibold`.
- Buttons use `font-semibold`. Section labels use `text-sm text-muted-foreground`.
  - Correct: `<PageHeader title="Ví" />`. Incorrect: a new `<h1 className="text-xl">` on a page.

## 4. Spacing, radius, elevation

- Base radius `--radius: 1rem`. Common scale:
  - `rounded-xl`: tx thumbnails, sidebar links.
  - `rounded-2xl`: rows, calendar cells, gallery tiles, inner warnings.
  - `rounded-3xl`: every surface card and dialog.
  - `rounded-[2rem]` / `rounded-[2.5rem]`: composer dialog, camera and hero photo.
  - `rounded-full`: buttons, chips, segmented controls, nav, FAB, avatars.
  - Fields: `0.875rem` (the `field` utility).
- Page stacks use `gap-4` (home/profile) and `gap-3` (grids). Cards use `p-4` (lists `p-2`, calendar `p-3`, Empty `p-7`). `PageHeader` uses `py-5`.
- **Shadows:** a flat UI. There are no drop shadows on cards, inputs, textareas or toggles. Only these exist:
  - `shadow-fab` (primary glow) on the FAB and the route progress bar.
  - Inset bevel shadows inside `Button` variants.
- **Blur:** `glass-nav` (blur 18px, saturate 1.4, surface-2 at 72%); `amount-hidden` (blur 7px) for hidden amounts.
  - Incorrect: adding `shadow-md` to a card or `shadow-sm` to an `Input`.

## 5. Buttons and controls

**`Button`** (`src/components/ui/button.tsx`) — a pill (`rounded-full`), `font-semibold`, pressed state `active:scale-[0.96] active:translate-y-px`, 150ms.

- Variants:
  - `default`: top-to-bottom gradient primary → primary darkened 14%, with an inset highlight and bottom edge.
  - `destructive`: same treatment in red.
  - `outline`: surface-2 with a border and light bevel.
  - `secondary`: bevel on secondary.
  - `ghost`: no fill.
  - `link`: no press scale.
- Sizes: `default h-11 px-5`, `sm h-9`, `lg h-12`, `icon size-10`.
- Correct: `<Button onClick={save}>Lưu</Button>`. Incorrect: `<button className="rounded-xl bg-primary px-4">`, a hand-made primary.

**Custom controls that are NOT Button** (they intentionally keep their own markup):

- **Round icon buttons:** `grid size-11|12 place-items-center rounded-full bg-accent text-accent-foreground` (hide-amount toggle, gallery link, "back to this month").
- **Segmented control** (Ngày/Tháng): track `flex rounded-full bg-surface p-1`; item `min-h-11 rounded-full px-5 text-sm`; selected item `bg-surface-2 font-semibold`, other items `text-muted-foreground`.
- **Chips / filters:** `min-h-11 shrink-0 rounded-full px-5 text-sm`; active `bg-primary text-primary-foreground`, inactive `bg-surface text-muted-foreground`. They sit in a horizontal scroller `-mx-4 flex gap-2 overflow-x-auto px-4 pb-1`.
- **Month stepper:** `rounded-2xl bg-surface p-1` with `size-11` chevrons in `text-primary`.
- **Calendar cell** (`DayCell`, home route):
  - Cell: `h-16 rounded-2xl hover:bg-surface-2`.
  - Empty day: a big number `size-10 rounded-full text-base font-semibold`.
  - Day with transactions: a small number `h-5 text-xs font-bold` above a `size-10` thumbnail stack (`rounded-xl border-2 border-foreground/80`), with a `+N` badge (`bg-primary text-[10px]`).
  - Today is shown as `bg-primary text-primary-foreground` on the number.
- **Accent swatch:** `size-10 rounded-full`; selected `ring-2 ring-foreground ring-offset-2 ring-offset-surface`; low-contrast badge `!`.
- **Font tile:** `rounded-2xl border px-3 py-2.5`; selected `border-primary bg-accent`.
- **Settings Row** (profile): `min-h-14 rounded-2xl px-3 hover:bg-surface-2`, with the icon `[&_svg]:size-5 text-muted-foreground`.
- Incorrect: wrapping a chip or calendar cell in `<Button variant="secondary">`. The bevel, height and padding would change.

## 6. Form fields

- Every field uses the `field` utility (`src/styles.css`): `h-2.75rem`, radius 0.875rem, 1px border, `bg-surface-2`, no shadow, focus-visible `border-ring`.
  - `Input`: `src/components/ui/input.tsx`.
  - `SelectTrigger`: `src/components/ui/select.tsx`.
  - `Textarea`: `min-h-[80px] rounded-[0.875rem] bg-surface-2`, no shadow.
- Selects: use `AppSelect` from `src/components/pickers.tsx` (sentinel `__none__` for an empty value). Dates: `DatePicker` / `DateTimePicker` (Popover + Calendar, vi locale, DD/MM/YYYY). Never use a native `<select>` or `<input type="date">`.
- The composer amount input is a deliberate override: `h-16 rounded-2xl text-3xl font-bold`.
- Validation: inline `text-sm text-destructive` text and a `sonner` toast for failed requests.
  - Correct: `<AppSelect value={v} onChange={setV} options={…} />`. Incorrect: `<select className="field-select">`.

## 7. Surfaces and feedback

- **Card:** `rounded-3xl bg-surface p-4`, with no border and no shadow. The shadcn `Card` primitive is not used for page cards.
- **Dialog** (`src/components/ui/dialog.tsx`):
  - Width `w-[calc(100%-1.5rem)]`, max height respects the safe areas.
  - Callers add `rounded-3xl bg-surface`; the composer uses `rounded-[2rem]`.
- **Confirm:** always use `useConfirm()` (`src/components/confirm.tsx`, AlertDialog `rounded-3xl bg-surface sm:max-w-sm`). Never use `window.confirm` or `prompt`.
- **Empty state:** `Empty` in `src/components/shell.tsx`. Layout: `rounded-3xl bg-surface p-7`, an optional icon circle `size-14 bg-surface-2`, a title `font-semibold`, a body `text-sm muted`, and the action at `mt-4`.
  - Filtered-empty and never-had-data cases use different copy (`transactions.tsx`).
- **Loading:**
  - `Skeleton` (`shimmer rounded-md bg-surface-2`). Its shape mirrors the real content, e.g. `h-24 rounded-3xl` stat cards, `aspect-square rounded-2xl` gallery tiles, `size-10 rounded-full` calendar days.
  - `RouteProgress` / pending page (`src/components/route-progress.tsx`): a 3px primary bar under the safe area.
  - Real data enters with `fade-in` (180ms).
- **Error:** inline `text-sm text-destructive` ("Không tải được dữ liệu…"). The root `ErrorComponent` / `NotFoundComponent` are centred.
- **Offline:** the full-page `Offline` view.
- **Toasts:** `sonner`, `position="top-center"`, mounted once in `__root.tsx`.
- **Charts** (`reports.tsx`): `var(--chart-n)` fills and the `TOOLTIP` style (popover background, border, radius 12). When there is no data, show the Empty state instead of an empty chart.

## 8. Images

- `PhotoThumb` (`src/components/photo.tsx`) is the only way to show a stored photo. It uses `object-cover`, a shimmer until loaded, then a blur → sharp fade (200ms).
- Ratios:
  - Gallery `aspect-square rounded-2xl`, 3 columns `gap-2`.
  - Composer hero / camera `aspect-square max-w-sm|md rounded-[2.5rem]`.
  - Tx row thumbnail `size-12 rounded-xl`.
  - Calendar thumbnail `size-10` / `size-8`.
  - Detail viewer `object-contain max-h-[60dvh]`, which shows the full image and is not cropped.
- The camera mirrors the selfie camera (`-scale-x-100`) and captures a square.
  - Incorrect: `<img src={url} className="h-40 w-full">` with no `object-cover` or ratio.

## 9. Navigation and layout

- `AppShell` (`src/components/shell.tsx`):
  - Desktop (`md:`): a `w-60` sidebar with `bg-sidebar`. Active link `bg-sidebar-accent text-primary`.
  - Mobile:
    - Floating nav `fixed inset-x-3 bottom-[max(0.75rem,safe)]`, built from `glass-nav rounded-full p-1.5`, `max-w-md`.
    - Tab item `min-h-12 rounded-full`, icon `size-6`, active item `bg-background/60 text-primary`. Labels are `sr-only` below `sm`.
  - FAB: `size-16 rounded-full bg-primary shadow-fab`, at `bottom-[calc(6rem+safe)] right-5`, mobile only.
  - Main: `mx-auto max-w-3xl px-4`, `pb-[calc(7rem+safe-bottom)]` (clears the nav), `pt-[max(0.25rem,safe-top)]`.
- **Safe area:** `viewport-fit=cover` with a black-translucent status bar. Every fixed or full-screen layer (nav, FAB, camera, composer, auth, progress bar, dialogs) pads with `env(safe-area-inset-*)`.
- **Scrolling:** `overscroll-behavior-y: none` on html/body. Pull-to-refresh is custom (`PullToRefresh`: threshold 70, max 110, disabled inside dialogs and inputs). Horizontal scrolling is only allowed inside chip rows.
- Breakpoints: Tailwind defaults. `sm` shows nav labels; `md` switches to the sidebar and hides the FAB and bottom nav.

## 10. States

- Pressed: `Button` scales to 0.96 and moves down 1px.
- Hover: rows and cells use `hover:bg-surface-2`; buttons use `brightness-110` (primary) or `bg-accent` (outline/ghost).
- Focus: `focus-visible:ring-2 ring-ring ring-offset-2` on buttons; `border-ring` on fields.
- Selected: `bg-primary` (chips, today), `bg-surface-2 font-semibold` (segmented), `ring-2 ring-foreground` (swatches), `border-primary bg-accent` (font tiles).
- Disabled: `opacity-50 pointer-events-none`. Destructive actions use the `destructive` variant or `text-destructive` on secondary (sign out).
- Motion: 150–200ms. `prefers-reduced-motion` disables all animation globally.

## 11. Canonical components and composition

- Primitives live in `src/components/ui/` (one per control type: Button, Input, Textarea, Select, Dialog, AlertDialog, Popover, Calendar, Switch, Skeleton, Tabs …).
- Domain components live in `src/components/`: `AppShell`, `PageHeader`, `Empty`, `PhotoThumb`, `TxRow`, `BudgetCard`, `Composer`, `CameraCapture`, `AppSelect` / `DatePicker` / `DateTimePicker`, `ConfirmProvider` / `useConfirm`, `PullToRefresh`, `RouteProgress`, `WalletForm`, `Tutorial`.
- Routes orchestrate data and pass props. They do not own control markup (see AGENTS.md).
- **Never duplicate:**
  - the pill-button bevel
  - the `field` look
  - the Empty card
  - PhotoThumb loading
  - the confirm dialog
  - the safe-area offsets of the nav and FAB
  - the money formatting (`Money` / `src/lib/finance.ts`)
- **Intentional native elements:**
  - Hidden `<input type="file">` for the avatar and composer uploads: the platform file picker.
  - `<video>` and `<canvas>` in `CameraCapture`: camera access.
  - Raw `<button>` for the custom controls in section 5 (icon buttons, segmented items, chips, calendar cells, swatches, font tiles, the sidebar "Ghi giao dịch" and the FAB): their look differs on purpose from `Button`.
  - `<img>` for local blob previews and the logo.
  - Some of these still live in routes. They are tracked in `.architecture-baseline.json` as migration debt.

---

## Prompt for future coding agents

> You are modifying CapMoney, an existing Lovable app whose current rendered UI is the source of truth. Do not redesign it.
>
> 1. Read `DESIGN.md` and `AGENTS.md` fully before touching code.
> 2. Before creating any component, search `src/components/ui/` and `src/components/` with `rg`. Reuse canonical primitives (`Button`, `Input`, `Textarea`, `AppSelect`, `DatePicker`, `DateTimePicker`, `Dialog`, `useConfirm`, `Skeleton`) and domain components (`AppShell`, `PageHeader`, `Empty`, `PhotoThumb`, `TxRow`, `Composer`, `CameraCapture`). Do not fork a primitive.
> 3. Keep behaviour refactors and visual changes in separate, clearly labelled steps. A refactor must produce a pixel-identical result.
> 4. Preserve the existing colours (semantic tokens only, no raw hex or `text-white`), typography, spacing, dimensions, radius scale, the flat no-shadow look (only `shadow-fab` and Button bevels), responsive behaviour, safe-area offsets and every interaction state (hover, focus, pressed, selected, disabled, loading, destructive).
> 5. Never replace a native element with a shared component unless the rendered result is visually identical.
> 6. Never apply the generic `Button` style to tabs, segmented controls, chips, calendar cells, round icon buttons, swatches, font tiles, the FAB or other custom controls.
> 7. Check the layout at 375px and 402px mobile width, and confirm there is no horizontal overflow except inside chip scrollers. Respect the bottom nav and FAB clearance and `env(safe-area-inset-*)`.
> 8. Preserve image aspect ratios (`aspect-square`, `size-*`) and object positioning (`object-cover` for thumbnails, `object-contain` for the detail viewer). Use `PhotoThumb` for stored photos.
> 9. Financial and profile writes must go through the approved RPC/data layer. Never cache financial data offline.
> 10. Run the relevant tests (`bunx vitest run`), `bun run lint:architecture` and `bun run duplication:check`, and do a TypeScript check.
> 11. Review the final diff for unintended changes to className, inline style, DOM hierarchy or design tokens.
> 12. In your report, list every intentional visual change, every reused or new component, and every native-element exception.
> 13. If a request conflicts with this design system, stop and ask the user before proceeding.
>
> Do not invent a new design system, do not simplify existing styles, and do not normalise different controls into one style unless the app already does so.
