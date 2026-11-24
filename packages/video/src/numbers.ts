// Numbers on screen (F19): chart values in the Indian way (lakh and crore, in English and Hindi),
// a pie's slices as whole percentages that add up to 100, and a stat's value counting up to
// itself as it's said, when it's an amount.
export type Language = "en" | "hi";

const words = {
  en: { lakh: "lakh", crore: "crore", lakhCrore: "lakh crore" },
  hi: { lakh: "लाख", crore: "करोड़", lakhCrore: "लाख करोड़" },
} as const;

const grouped = (value: number, fraction: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: fraction }).format(value);

const roundTo = (value: number, fraction: number) =>
  Math.round(value * 10 ** fraction) / 10 ** fraction;

/** Decimals shown for a count: two below 10, one below 1,000, none above. */
const plainFraction = (value: number) => (value < 10 ? 2 : value < 1000 ? 1 : 0);
/** Decimals shown for a number of lakh or crore: one below 100, none above. */
const scaledFraction = (value: number) => (value < 100 ? 1 : 0);

/**
 * A chart value as people in India say it: up to 99,999 in full, then lakh, crore and lakh
 * crore. The scale is picked from the rounded value, so 99,999.6 reads "1 lakh", not
 * "1,00,000", and 99,99,999 reads "1 crore", not "100 lakh". Digits stay Latin in Hindi, as
 * Hindi news and finance graphics write them.
 */
export function formatNumber(value: number, language: Language): string {
  const w = words[language];
  if (roundTo(value, plainFraction(value)) < 1e5) return grouped(value, plainFraction(value));
  const tiers = [
    { by: 1e5, word: w.lakh, next: 100 },
    { by: 1e7, word: w.crore, next: 1e5 },
    { by: 1e12, word: w.lakhCrore, next: Number.POSITIVE_INFINITY },
  ];
  for (const { by, word, next } of tiers) {
    const n = value / by;
    const rounded = roundTo(n, scaledFraction(n));
    if (rounded < next) return `${grouped(rounded, scaledFraction(n))} ${word}`;
  }
  return grouped(value, 0); // Unreachable: the last tier takes everything.
}

/** A full count with Indian grouping, for a unit that already says its scale. */
const inFull = (value: number) => grouped(value, plainFraction(value));

/** Units written before the number: "₹1.2 lakh", "Rs 1,234", "US$5". */
const prefixUnit = /^(US\$|INR|Rs\.?|[₹$€£¥])/;
/** A unit that says its own scale: its number is written in full, not scaled again. */
const scaleWords =
  /\b(thousand|lakh|lakhs|crore|crores|million|billion|trillion)\b|हज़ार|हजार|लाख|करोड़/i;

/**
 * A value with its unit: "72%", "₹1.2 lakh", "Rs 1,234", "45 crore users". A unit with a
 * scale word ("₹ crore") keeps the number in full, so it never reads "crore crore".
 */
export function formatValue(value: number, language: Language, unit?: string): string {
  if (!unit) return formatNumber(value, language);
  const number = scaleWords.test(unit) ? inFull(value) : formatNumber(value, language);
  if (unit === "%") return `${number}%`;
  const prefix = prefixUnit.exec(unit)?.[0];
  if (prefix) {
    const rest = unit.slice(prefix.length).trim();
    // A sign sits against the number; letters ("Rs", "INR") take a space.
    const gap = /[A-Za-z.]$/.test(prefix) ? " " : "";
    return `${prefix}${gap}${number}${rest ? ` ${rest}` : ""}`;
  }
  return `${number} ${unit}`;
}

/**
 * Whole percentages of the total that add up to exactly 100 (largest remainder), so a pie's
 * legend never reads 99% or 101%. The schema guarantees one value above 0.
 */
export function percentages(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const result = exact.map(Math.floor);
  let left = 100 - result.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    result[i]! += 1;
    left -= 1;
  }
  return result;
}

/**
 * What may come before an amount: nothing, a sign ("+35%", "−2%"), a currency ("₹", "Rs ",
 * "US$"), or a sign and a currency ("+₹500").
 */
const amountBefore = /^[+\-−]?(?:(?:US\$|INR|Rs\.?|[₹$€£¥])\s?)?$/;
/**
 * What may come after an amount: nothing, "%" or "+", a short scale ("K", "L", "Cr", "M",
 * "B"), or a space and words without digits (" lakh", " users").
 */
const amountAfter = /^(?:%|\+|(?:K|k|L|Cr|cr|M|B|Bn|bn)\+?)?(?:\s+\D*)?$/;
/** A first word after a number that makes it a quantity, not a year ("1200 crore"). */
const scaleWord =
  /^\s+(?:thousand|lakh|lakhs|crore|crores|million|billion|trillion|हज़ार|हजार|लाख|करोड़)(?:\s|$)/i;

/**
 * Whether a stat value is an amount that can count up: "72%", "+35%", "₹1,20,000", "10
 * crore users", "4.5". Not a year ("1947", "1947 AD", "2024 elections": a plain number from
 * 1000 to 2100 with no sign, currency, grouping, "%" or scale), a name with a number in it
 * ("5G", "COVID-19", "24x7"), a rank ("#1") or a ratio ("1 in 3"): counting those would show
 * other, wrong values.
 */
export function countsUp(value: string): boolean {
  const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) return false;
  const [, before, digits, after] = match as unknown as [string, string, string, string];
  if (!amountBefore.test(before) || !amountAfter.test(after)) return false;
  const yearLike = /^\d{4}$/.test(digits) && Number(digits) >= 1000 && Number(digits) <= 2100;
  const plainAfter = after === "" || (/^\s/.test(after) && !scaleWord.test(after));
  return !(yearLike && before === "" && plainAfter);
}

/**
 * The text of a stat as it counts up, `progress` 0 → 1. "72%" reads "0%", "36%", "72%";
 * "₹1,20,000" keeps its symbol, decimals and grouping. A value that isn't an amount
 * (`countsUp`) stays as it is.
 */
export function countingText(value: string, progress: number): string {
  if (progress >= 1 || !countsUp(value)) return value;
  const [, before, digits, after] = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value) as unknown as [
    string,
    string,
    string,
    string,
  ];
  const target = Number(digits.replace(/,/g, ""));
  const decimals = digits.includes(".") ? digits.split(".")[1]!.length : 0;
  const now = target * Math.max(0, progress);
  const locale = digits.includes(",") && grouped(target, decimals) !== digits ? "en-US" : "en-IN";
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: digits.includes(","),
  }).format(now);
  return `${before}${text}${after}`;
}
