import { BillGroup, CurrencyCode } from '../types/bill';
import { AVATAR_COLORS } from './currencies';
import { generateSyncKey } from '../services/cloudSync';

export function createDemoGroup(): BillGroup {
  return {
    id: 'tokyo-trip-demo',
    name: '東京五天四夜好友行',
    description: '新宿住宿、敘敘苑燒肉、迪士尼門票與交通分帳',
    coverEmoji: '🗼',
    baseCurrency: 'TWD',
    customRates: {
      JPY: 0.215,
      USD: 32.1,
    },
    members: [
      {
        id: 'm-mona',
        name: 'Mona',
        avatarColor: AVATAR_COLORS[0],
        paymentInfo: 'LINE Pay / 台新 (812) 2888-1001-2345',
      },
      {
        id: 'm-alice',
        name: 'Alice',
        avatarColor: AVATAR_COLORS[1],
        paymentInfo: '街口支付 / 國泰 (013) 0012-3456-7890',
      },
      {
        id: 'm-bob',
        name: 'Bob',
        avatarColor: AVATAR_COLORS[2],
        paymentInfo: 'LINE Pay 直接轉',
      },
      {
        id: 'm-kevin',
        name: 'Kevin',
        avatarColor: AVATAR_COLORS[3],
      },
    ],
    expenses: [
      {
        id: 'exp-1',
        title: '新宿格拉斯麗飯店 4 晚住宿',
        category: 'stay',
        date: '2026-10-28',
        currency: 'TWD',
        exchangeRateToBase: 1,
        originalAmount: 24000,
        baseAmount: 24000,
        paidBy: [{ memberId: 'm-mona', amount: 24000 }],
        splitMode: 'equal',
        splits: [
          { memberId: 'm-mona', value: 1, calculatedAmount: 6000 },
          { memberId: 'm-alice', value: 1, calculatedAmount: 6000 },
          { memberId: 'm-bob', value: 1, calculatedAmount: 6000 },
          { memberId: 'm-kevin', value: 1, calculatedAmount: 6000 },
        ],
        note: 'Mona 刷海外回饋卡先墊付，4人平分',
        createdAt: Date.now() - 86400000 * 3,
        createdBy: 'Mona',
      },
      {
        id: 'exp-2',
        title: '敘敘苑晴空塔景觀燒肉晚餐',
        category: 'food',
        date: '2026-10-29',
        currency: 'JPY',
        exchangeRateToBase: 0.215,
        originalAmount: 36000,
        baseAmount: 7740,
        serviceFeePercent: 10,
        paidBy: [{ memberId: 'm-alice', amount: 36000 }],
        splitMode: 'shares',
        splits: [
          { memberId: 'm-mona', value: 1, calculatedAmount: 7200 },
          { memberId: 'm-alice', value: 1, calculatedAmount: 7200 },
          { memberId: 'm-bob', value: 1.5, calculatedAmount: 10800 },
          { memberId: 'm-kevin', value: 1.5, calculatedAmount: 10800 },
        ],
        note: '男生加點和牛套餐算 1.5 份、女生 1 份',
        createdAt: Date.now() - 86400000 * 2,
        createdBy: 'Alice',
      },
      {
        id: 'exp-3',
        title: '成田機場 Skyliner 來回車票',
        category: 'transport',
        date: '2026-10-30',
        currency: 'JPY',
        exchangeRateToBase: 0.215,
        originalAmount: 18000,
        baseAmount: 3870,
        paidBy: [{ memberId: 'm-bob', amount: 18000 }],
        splitMode: 'equal',
        splits: [
          { memberId: 'm-mona', value: 1, calculatedAmount: 4500 },
          { memberId: 'm-alice', value: 1, calculatedAmount: 4500 },
          { memberId: 'm-bob', value: 1, calculatedAmount: 4500 },
          { memberId: 'm-kevin', value: 1, calculatedAmount: 4500 },
        ],
        note: 'Bob 在櫃檯一次買齊 4 人份車票',
        createdAt: Date.now() - 86400000,
        createdBy: 'Bob',
      },
      {
        id: 'exp-4',
        title: '澀谷居酒屋宵夜小酌',
        category: 'drink',
        date: '2026-10-31',
        currency: 'JPY',
        exchangeRateToBase: 0.215,
        originalAmount: 14000,
        baseAmount: 3010,
        paidBy: [
          { memberId: 'm-mona', amount: 10000 },
          { memberId: 'm-kevin', amount: 4000 },
        ],
        splitMode: 'exact',
        splits: [
          { memberId: 'm-mona', value: 3000, calculatedAmount: 3000 },
          { memberId: 'm-alice', value: 2000, calculatedAmount: 2000 },
          { memberId: 'm-bob', value: 4500, calculatedAmount: 4500 },
          { memberId: 'm-kevin', value: 4500, calculatedAmount: 4500 },
        ],
        note: 'Mona 湊日幣現鈔 10,000 + Kevin 出 4,000；Alice 不喝酒少算',
        createdAt: Date.now() - 3600000 * 6,
        createdBy: 'Mona',
      },
    ],
    settledRecords: [],
    updatedAt: 1000,
  };
}

export function createKaohsiungGroup(): BillGroup {
  return {
    id: 'kaohsiung-trip',
    syncKey: generateSyncKey(),
    name: '高雄之旅',
    description: '高雄好友出遊、美食聚餐與交通住宿分帳',
    coverEmoji: '🏖️',
    baseCurrency: 'TWD',
    customRates: {},
    members: [
      {
        id: 'm-mona',
        name: 'Mona',
        avatarColor: AVATAR_COLORS[0],
      },
      {
        id: 'm-friend-a',
        name: '好友 A',
        avatarColor: AVATAR_COLORS[1],
      },
      {
        id: 'm-friend-b',
        name: '好友 B',
        avatarColor: AVATAR_COLORS[2],
      },
    ],
    expenses: [],
    settledRecords: [],
    updatedAt: 1000,
  };
}

export function createBlankGroup(
  name: string,
  coverEmoji: string,
  baseCurrency: CurrencyCode,
  memberNames: string[]
): BillGroup {
  const cleanNames = memberNames.map((n) => n.trim()).filter(Boolean);
  const finalNames = cleanNames.length >= 2 ? cleanNames : ['我', '好友 A', '好友 B'];
  const id = `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    syncKey: generateSyncKey(),
    name: name.trim() || '未命名分帳群組',
    coverEmoji: coverEmoji || '💸',
    baseCurrency,
    customRates: {},
    members: finalNames.map((n, idx) => ({
      id: `m-${idx + 1}-${Math.random().toString(36).slice(2, 5)}`,
      name: n,
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    })),
    expenses: [],
    settledRecords: [],
    updatedAt: Date.now(),
  };
}
