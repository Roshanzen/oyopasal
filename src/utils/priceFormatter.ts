import { Language } from '../types/common';

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toNepaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => NEPALI_DIGITS[Number(digit)] ?? digit);
}

export function formatPrice(amount: number | string, lang: Language = 'en'): string {
  const prefix = lang === 'ne' ? 'रु.' : 'Rs.';
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(numeric)) return `${prefix} 0`;
  const formatted = numeric.toLocaleString('en-IN');
  return lang === 'ne' ? `${prefix} ${toNepaliDigits(formatted)}` : `${prefix} ${formatted}`;
}

export function formatCompactCurrency(amount: number, lang: Language = 'en'): string {
  if (amount >= 100000) {
    return `${lang === 'ne' ? 'रु.' : 'Rs.'} ${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `${lang === 'ne' ? 'रु.' : 'Rs.'} ${(amount / 1000).toFixed(1)}k`;
  }
  return formatPrice(amount, lang);
}
