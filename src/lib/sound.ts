// Tap sounds via Web Audio (no files). On/off is a device display preference, not financial data.
const KEY = "capmoney-sound";
let ctx: AudioContext | null = null;

export const soundEnabled = () => typeof localStorage !== "undefined" && localStorage.getItem(KEY) !== "off";
export function setSoundEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "on" : "off");
  if (on) playTap();
}

export function playTap() {
  if (!soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch { /* audio unavailable */ }
}

/** One global listener: any button, link or switch tap plays the sound. */
export function installTapSounds() {
  const on = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest('button, a[href], [role="button"], [role="switch"], [role="tab"], [role="option"]')) playTap();
  };
  document.addEventListener("pointerdown", on, { passive: true });
  return () => document.removeEventListener("pointerdown", on);
}
