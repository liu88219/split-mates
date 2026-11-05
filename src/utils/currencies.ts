import { CurrencyCode, CurrencyMeta, ExpenseCategory } from '../types/bill';

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  TWD: { code: 'TWD', symbol: 'NT$', name: '新台幣', flag: '🇹🇼', defaultRateToTWD: 1 },
  JPY: { code: 'JPY', symbol: '¥', name: '日圓', flag: '🇯🇵', defaultRateToTWD: 0.215 },
  KRW: { code: 'KRW', symbol: '₩', name: '韓元', flag: '🇰🇷', defaultRateToTWD: 0.0235 },
  USD: { code: 'USD', symbol: '$', name: '美金', flag: '🇺🇸', defaultRateToTWD: 32.1 },
  EUR: { code: 'EUR', symbol: '€', name: '歐元', flag: '🇪🇺', defaultRateToTWD: 34.8 },
  THB: { code: 'THB', symbol: '฿', name: '泰銖', flag: '🇹🇭', defaultRateToTWD: 0.95 },
  HKD: { code: 'HKD', symbol: 'HK$', name: '港幣', flag: '🇭🇰', defaultRateToTWD: 4.12 },
  GBP: { code: 'GBP', symbol: '£', name: '英鎊', flag: '🇬🇧', defaultRateToTWD: 41.5 },
  SGD: { code: 'SGD', symbol: 'S$', name: '新幣', flag: '🇸🇬', defaultRateToTWD: 24.1 },
};

export const CURRENCY_LIST: CurrencyMeta[] = Object.values(CURRENCIES);

export const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; emoji: string; badgeClass: string }
> = {
  food: { label: '餐飲美食', emoji: '🍽️', badgeClass: 'bg-orange-100 text-orange-700' },
  stay: { label: '住宿飯店', emoji: '🏨', badgeClass: 'bg-indigo-100 text-indigo-700' },
  transport: { label: '交通車資', emoji: '🚆', badgeClass: 'bg-sky-100 text-sky-700' },
  shopping: { label: '購物伴手禮', emoji: '🛍️', badgeClass: 'bg-pink-100 text-pink-700' },
  ticket: { label: '門票娛樂', emoji: '🎟️', badgeClass: 'bg-purple-100 text-purple-700' },
  drink: { label: '咖啡酒水', emoji: '🍻', badgeClass: 'bg-amber-100 text-amber-700' },
  settlement: { label: '結清還款', emoji: '🤝', badgeClass: 'bg-emerald-100 text-emerald-700' },
  other: { label: '其他雜項', emoji: '📦', badgeClass: 'bg-slate-100 text-slate-700' },
};

export const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-pink-500',
];

/**
 * 計算 1 單位 fromCurrency 等於多少單位 baseCurrency
 */
export function getDefaultExchangeRate(from: CurrencyCode, base: CurrencyCode): number {
  if (from === base) return 1;
  const fromToTwd = CURRENCIES[from]?.defaultRateToTWD ?? 1;
  const baseToTwd = CURRENCIES[base]?.defaultRateToTWD ?? 1;
  const rate = fromToTwd / baseToTwd;
  return Number(rate.toPrecision(4));
}

/**
 * 從公開免費匯率 API (open.er-api.com) 抓取最新匯率，失敗時優雅退回內建預設匯率
 */
export async function fetchLiveRatesToBase(
  baseCurrency: CurrencyCode
): Promise<Partial<Record<CurrencyCode, number>>> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    if (!res.ok) throw new Error('Exchange API error');
    const data = await res.json();
    const rates: Partial<Record<CurrencyCode, number>> = {};
    if (data && data.rates) {
      (Object.keys(CURRENCIES) as CurrencyCode[]).forEach((code) => {
        if (code === baseCurrency) {
          rates[code] = 1;
        } else if (data.rates[code]) {
          // data.rates[code] 是 1 baseCurrency = X code
          // 我們需要 1 code = ? baseCurrency
          const inverted = 1 / Number(data.rates[code]);
          rates[code] = Number(inverted.toPrecision(4));
        }
      });
    }
    return rates;
  } catch {
    const fallback: Partial<Record<CurrencyCode, number>> = {};
    (Object.keys(CURRENCIES) as CurrencyCode[]).forEach((code) => {
      fallback[code] = getDefaultExchangeRate(code, baseCurrency);
    });
    return fallback;
  }
}

export function formatMoney(amount: number, currency: CurrencyCode = 'TWD'): string {
  const meta = CURRENCIES[currency] || CURRENCIES.TWD;
  const rounded = Math.abs(amount) < 0.005 ? 0 : amount;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.05;
  const formatted = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: isWhole ? 0 : 1,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(rounded);
  return `${meta.symbol}${formatted}`;
}
