// Parses everyday spoken Vietnamese money ("ba củ", "hai xị", "hai chai rưỡi", "ba chục", "35k") into VND.
const DIGITS: Record<string, number> = {
  không: 0, một: 1, mốt: 1, hai: 2, ba: 3, bốn: 4, tư: 4, năm: 5, lăm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9, mười: 10,
};
const UNITS: Record<string, number> = {
  k: 1_000, nghìn: 1_000, ngàn: 1_000, cành: 1_000,
  chục: 10_000, xị: 100_000, lít: 100_000, trăm: 100_000,
  củ: 1_000_000, chai: 1_000_000, triệu: 1_000_000, tr: 1_000_000, m: 1_000_000,
  tỷ: 1_000_000_000, tỉ: 1_000_000_000,
};

/** Returns VND, or null when no amount is found. */
export function parseSpokenVnd(input: string): number | null {
  const s = input.toLowerCase().normalize("NFC");
  const re = /(\d+(?:[.,]\d+)?|không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín|mười)\s*(k|nghìn|ngàn|cành|chục|xị|lít|trăm|củ|chai|triệu|tr|m|tỷ|tỉ)(?!\p{L})(?:\s*(rưỡi|\d|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín))?/u;
  const m = s.match(re);
  if (!m) return null;
  const n = /\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : DIGITS[m[1]];
  const unit = UNITS[m[2]];
  let total = n * unit;
  if (m[3]) {
    if (m[3] === "rưỡi") total += unit / 2;
    else {
      const d = /\d/.test(m[3]) ? Number(m[3]) : DIGITS[m[3]];
      total += (d * unit) / 10; // "1tr2" = 1.200.000, "ba củ rưỡi"
    }
  }
  return Math.round(total);
}

export const SLANG_HINT =
  "Tiếng lóng tiền: 'củ'/'chai'/'tr' = triệu, 'xị'/'lít' = trăm nghìn, 'chục' = chục nghìn, 'k'/'cành'/'nghìn' = nghìn, 'rưỡi' = thêm nửa đơn vị (hai chai rưỡi = 2.500.000), '1tr2' = 1.200.000.";
