export type CurrencyCode = 'TWD' | 'JPY' | 'KRW' | 'USD' | 'EUR' | 'THB' | 'HKD' | 'GBP' | 'SGD';

export type SplitMode = 'equal' | 'exact' | 'shares' | 'percent';

export type ExpenseCategory =
  | 'food'
  | 'stay'
  | 'transport'
  | 'shopping'
  | 'ticket'
  | 'drink'
  | 'settlement'
  | 'other';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  defaultRateToTWD: number;
}

export interface Member {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  lineUserId?: string;
  /** 收款資訊，例如：LINE Pay / 街口 / 台新 (812) 1234-5678-9012 */
  paymentInfo?: string;
}

export interface PayerItem {
  memberId: string;
  /** 墊付金額（原幣別） */
  amount: number;
}

export interface SplitItem {
  memberId: string;
  /**
   * 依分攤模式而異：
   * - equal: 1 表示參與分攤，0 表示不參與
   * - exact: 該成員應分攤之原幣別精確金額
   * - shares: 份數 (例如 1 份、2 份)
   * - percent: 百分比 (0 ~ 100)
   */
  value: number;
  /** 換算後該成員在此筆消費實際應分攤之原幣別金額 */
  calculatedAmount: number;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  date: string;
  currency: CurrencyCode;
  /** 1 單位原幣別 = 多少群組基準幣別 (例如 JPY -> TWD 為 0.215) */
  exchangeRateToBase: number;
  /** 原幣別總金額 (含服務費) */
  originalAmount: number;
  /** 換算為群組基準幣別 (例如 TWD) 之總金額 */
  baseAmount: number;
  /** 服務費/稅金百分比 (選填，例如 10%) */
  serviceFeePercent?: number;
  /** 誰先墊付（支援單人或多人共同墊付） */
  paidBy: PayerItem[];
  splitMode: SplitMode;
  splits: SplitItem[];
  note?: string;
  createdAt: number;
  createdBy?: string;
}

export interface SettlementRecord {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  /** 已結清金額（群組基準幣別） */
  amount: number;
  settledAt: number;
  note?: string;
}

export interface BillGroup {
  id: string;
  /** 群組專屬隨機同步金鑰（僅透過私密分享連結傳遞，避免公開頻道遭猜測） */
  syncKey?: string;
  name: string;
  description?: string;
  coverEmoji: string;
  /** 自訂群組圖片 (DataURL 或圖片網址，選填) */
  coverImageUrl?: string;
  /** 是否已結束並移至「歷史封存區」 */
  isArchived?: boolean;
  baseCurrency: CurrencyCode;
  /** 群組自訂固定匯率 (1 原幣 = X 基準幣) */
  customRates: Partial<Record<CurrencyCode, number>>;
  members: Member[];
  expenses: Expense[];
  settledRecords: SettlementRecord[];
  updatedAt: number;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  /** 該成員累計實際應分攤總額（基準幣） */
  totalOwed: number;
  /** 該成員累計實際先墊付總額（基準幣） */
  totalPaid: number;
  /** 已透過結清紀錄支付/收訖之調整額（基準幣） */
  settledAdjustment: number;
  /** 淨額 = totalPaid - totalOwed + settledAdjustment（正數代表應收回，負數代表應付給別人） */
  netBalance: number;
}

export interface SimplifiedTransfer {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  /** 建議轉帳金額（基準幣，四捨五入至整數或小數第一位） */
  amount: number;
}
