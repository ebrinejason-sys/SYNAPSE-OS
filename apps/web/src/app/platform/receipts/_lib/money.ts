/** Client-safe UGX parse / format helpers (no server imports). */

export function parseAmountUgx(raw: unknown): number | null {
  if (raw == null) return null;
  let cleaned = String(raw)
    .trim()
    .replace(/ugx/gi, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    if (/^-?\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
    else cleaned = cleaned.replace(/,/g, "");
  }

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function formatMoneyUGX(value: number): string {
  const abs = Math.abs(value);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  return `UGX ${value.toLocaleString("en-UG", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] ?? "";
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    const tens = TENS[t] ?? "";
    const ones = ONES[o] ?? "";
    return o ? `${tens}-${ones}` : tens;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundreds = ONES[h] ?? "";
  return rest ? `${hundreds} hundred ${underThousand(rest)}` : `${hundreds} hundred`;
}

/** e.g. "One hundred fifty thousand shillings only" */
export function amountInWordsUGX(value: number): string {
  const whole = Math.floor(Math.abs(value));
  const cents = Math.round((Math.abs(value) - whole) * 100);

  if (whole === 0 && cents === 0) return "Zero shillings only";

  const parts: string[] = [];
  let n = whole;
  const scales: [number, string][] = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];

  for (const [scale, label] of scales) {
    if (n >= scale) {
      const chunk = Math.floor(n / scale);
      parts.push(`${underThousand(chunk)} ${label}`);
      n %= scale;
    }
  }
  if (n > 0) parts.push(underThousand(n));

  let words = parts.join(" ").replace(/\s+/g, " ").trim();
  words = words.charAt(0).toUpperCase() + words.slice(1);

  if (cents > 0) {
    return `${words} shillings and ${underThousand(cents)} cents only`;
  }
  return `${words} shillings only`;
}
