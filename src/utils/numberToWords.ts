/**
 * Converts a numeric Pakistani Rupee amount into proper words
 * Example: 119740 -> "Rupee One Hundred Nineteen Thousand Seven Hundred Forty"
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertThreeDigits(num: number): string {
  let result = "";
  if (num >= 100) {
    result += ONES[Math.floor(num / 100)] + " Hundred ";
    num %= 100;
  }
  if (num >= 20) {
    result += TENS[Math.floor(num / 10)] + " ";
    num %= 10;
  }
  if (num > 0) {
    result += ONES[num] + " ";
  }
  return result.trim();
}

export function convertRupeesToWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return "Rupee Zero";
  }

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  let num = integerPart;
  const parts: string[] = [];

  // Crores (1,00,00,000)
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    parts.push(convertThreeDigits(crores) + " Crore");
    num %= 10000000;
  }

  // Lakhs (1,00,000)
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    parts.push(convertThreeDigits(lakhs) + " Lakh");
    num %= 100000;
  }

  // Thousands (1,000)
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    parts.push(convertThreeDigits(thousands) + " Thousand");
    num %= 1000;
  }

  // Remaining (Hundreds & Tens)
  if (num > 0) {
    parts.push(convertThreeDigits(num));
  }

  let words = "Rupee " + parts.join(" ").replace(/\s+/g, " ").trim();

  if (decimalPart > 0) {
    words += " and Paisa " + convertThreeDigits(decimalPart);
  }

  return words;
}

export function formatPakistaniRupees(amount: number): string {
  if (isNaN(amount)) return "Rs. 0.00";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("PKR", "Rs.");
}
