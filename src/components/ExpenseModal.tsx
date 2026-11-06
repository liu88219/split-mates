import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Users,
  Sparkles,
  RefreshCw,
  AlertCircle,
  UserMinus,
  CheckSquare,
  Square,
  Camera,
} from 'lucide-react';
import {
  BillGroup,
  CurrencyCode,
  Expense,
  ExpenseCategory,
  PayerItem,
  SplitMode,
} from '../types/bill';
import {
  CATEGORY_META,
  CURRENCY_LIST,
  CURRENCIES,
  formatMoney,
  getCreamyAvatarClass,
  getDefaultExchangeRate,
} from '../utils/currencies';
import { computeSplitAmounts } from '../utils/settlement';
import { BoboFaceBadge, QuokkaFaceBadge } from './QuokkaBoboArt';

interface ExpenseModalProps {
  isOpen: boolean;
  group: BillGroup;
  editingExpense: Expense | null;
  liveRates: Partial<Record<CurrencyCode, number>>;
  onClose: () => void;
  onSave: (expenseData: Omit<Expense, 'id' | 'createdAt'>, existingId?: string) => void;
  onSwitchToReceiptScanner?: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  group,
  editingExpense,
  liveRates,
  onClose,
  onSave,
  onSwitchToReceiptScanner,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<CurrencyCode>(group.baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [rawSubtotal, setRawSubtotal] = useState<string>('');
  const [serviceFeePercent, setServiceFeePercent] = useState<number>(0);

  // Payers: single vs multi
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState<string>(group.members[0]?.id || '');
  const [multiPayers, setMultiPayers] = useState<Record<string, string>>({});
  // Quick toggle: Payer is only advancing money and does NOT participate in splitting
  const [excludePayerFromSplit, setExcludePayerFromSplit] = useState(false);

  // Split mode & values
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form when modal opens or editingExpense changes
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (editingExpense) {
      setTitle(editingExpense.title);
      setCategory(editingExpense.category);
      setDate(editingExpense.date);
      setCurrency(editingExpense.currency);
      setExchangeRate(String(editingExpense.exchangeRateToBase));
      const fee = editingExpense.serviceFeePercent || 0;
      setServiceFeePercent(fee);
      const sub =
        fee > 0
          ? Number((editingExpense.originalAmount / (1 + fee / 100)).toFixed(2))
          : editingExpense.originalAmount;
      setRawSubtotal(String(sub));

      const payerIds = editingExpense.paidBy.filter((p) => p.amount > 0).map((p) => p.memberId);
      if (editingExpense.paidBy.length > 1) {
        setIsMultiPayer(true);
        const map: Record<string, string> = {};
        editingExpense.paidBy.forEach((p) => {
          map[p.memberId] = String(p.amount);
        });
        setMultiPayers(map);
      } else {
        setIsMultiPayer(false);
        setSinglePayerId(
          editingExpense.paidBy[0]?.memberId || group.members[0]?.id || ''
        );
        setMultiPayers({});
      }

      setSplitMode(editingExpense.splitMode);
      const valMap: Record<string, number> = {};
      group.members.forEach((m) => {
        const found = editingExpense.splits.find((s) => s.memberId === m.id);
        valMap[m.id] = found ? found.value : 0;
      });
      setSplitValues(valMap);

      const allPayersExcluded =
        payerIds.length > 0 && payerIds.every((pid) => (valMap[pid] || 0) === 0);
      setExcludePayerFromSplit(allPayersExcluded);
      setNote(editingExpense.note || '');
    } else {
      setTitle('');
      setCategory('food');
      setDate(new Date().toISOString().slice(0, 10));
      setCurrency(group.baseCurrency);
      setExchangeRate('1');
      setRawSubtotal('');
      setServiceFeePercent(0);
      setIsMultiPayer(false);
      setSinglePayerId(group.members[0]?.id || '');
      setMultiPayers({});
      setExcludePayerFromSplit(false);
      setSplitMode('equal');
      const defaultSplits: Record<string, number> = {};
      group.members.forEach((m) => {
        defaultSplits[m.id] = 1;
      });
      setSplitValues(defaultSplits);
      setNote('');
    }
  }, [isOpen, editingExpense, group]);

  const subtotalNum = Math.max(0, parseFloat(rawSubtotal) || 0);
  const originalTotal = useMemo(() => {
    return Number((subtotalNum * (1 + serviceFeePercent / 100)).toFixed(2));
  }, [subtotalNum, serviceFeePercent]);

  const rateNum = Math.max(0.0001, parseFloat(exchangeRate) || 1);
  const baseTotal = useMemo(() => {
    if (currency === group.baseCurrency) return originalTotal;
    return Number((originalTotal * rateNum).toFixed(2));
  }, [originalTotal, currency, group.baseCurrency, rateNum]);

  // Helper to get current active payer member IDs
  const currentPayerIds = useMemo(() => {
    if (!isMultiPayer) {
      return singlePayerId ? [singlePayerId] : [];
    }
    return Object.entries(multiPayers)
      .filter(([, val]) => (parseFloat(val) || 0) > 0)
      .map(([id]) => id);
  }, [isMultiPayer, singlePayerId, multiPayers]);

  // Apply "Exclude Payer from Split" whenever toggled or when payer changes while toggle is ON
  const applyExcludePayer = (
    shouldExclude: boolean,
    payerIdsToExclude: string[],
    currentValues: Record<string, number>,
    mode: SplitMode
  ) => {
    const next = { ...currentValues };
    if (shouldExclude) {
      payerIdsToExclude.forEach((pid) => {
        next[pid] = 0;
      });
      const hasAnyActive = group.members.some(
        (m) => !payerIdsToExclude.includes(m.id) && (next[m.id] || 0) > 0
      );
      if (!hasAnyActive) {
        group.members.forEach((m) => {
          if (!payerIdsToExclude.includes(m.id)) {
            next[m.id] = mode === 'equal' || mode === 'shares' ? 1 : 0;
          }
        });
      }
    } else {
      payerIdsToExclude.forEach((pid) => {
        if ((next[pid] || 0) === 0) {
          next[pid] = mode === 'equal' || mode === 'shares' ? 1 : 0;
        }
      });
    }
    setSplitValues(next);
  };

  const handleToggleExcludePayer = (checked: boolean) => {
    setExcludePayerFromSplit(checked);
    applyExcludePayer(checked, currentPayerIds, splitValues, splitMode);
  };

  const handleSelectSinglePayer = (memberId: string) => {
    setSinglePayerId(memberId);
    if (excludePayerFromSplit) {
      const next: Record<string, number> = {};
      group.members.forEach((m) => {
        if (m.id === memberId) {
          next[m.id] = 0;
        } else {
          next[m.id] =
            (splitValues[m.id] || 0) > 0
              ? splitValues[m.id]
              : splitMode === 'equal' || splitMode === 'shares'
              ? 1
              : 0;
        }
      });
      setSplitValues(next);
    }
  };

  // Toggle an individual member's participation checkbox
  const handleToggleMemberParticipation = (memberId: string) => {
    const currentVal = splitValues[memberId] ?? 0;
    const isCurrentlyActive = currentVal > 0;
    const next = { ...splitValues };

    if (isCurrentlyActive) {
      next[memberId] = 0;
    } else {
      if (splitMode === 'equal' || splitMode === 'shares') {
        next[memberId] = 1;
      } else if (splitMode === 'percent') {
        const currentSum = Object.values(next).reduce((s, v) => s + (Number(v) || 0), 0);
        next[memberId] = Math.max(0, Number((100 - currentSum).toFixed(1)));
      } else if (splitMode === 'exact') {
        const currentSum = Object.values(next).reduce((s, v) => s + (Number(v) || 0), 0);
        next[memberId] = Math.max(0, Number((originalTotal - currentSum).toFixed(2)));
      }
    }

    if (currentPayerIds.includes(memberId)) {
      const allPayersZero = currentPayerIds.every((pid) => (next[pid] || 0) === 0);
      setExcludePayerFromSplit(allPayersZero);
    }

    setSplitValues(next);
  };

  const handleCurrencyChange = (newCurr: CurrencyCode) => {
    setCurrency(newCurr);
    if (newCurr === group.baseCurrency) {
      setExchangeRate('1');
      return;
    }
    const custom = group.customRates?.[newCurr];
    const live = liveRates?.[newCurr];
    const fallback = getDefaultExchangeRate(newCurr, group.baseCurrency);
    setExchangeRate(String(custom || live || fallback));
  };

  const handleSplitModeChange = (newMode: SplitMode) => {
    setSplitMode(newMode);
    const activeMembers = group.members.filter((m) => (splitValues[m.id] || 0) > 0);
    const targetMembers = activeMembers.length > 0 ? activeMembers : group.members;
    const activeSet = new Set(targetMembers.map((m) => m.id));

    const next: Record<string, number> = {};
    if (newMode === 'equal' || newMode === 'shares') {
      group.members.forEach((m) => {
        next[m.id] = activeSet.has(m.id) ? 1 : 0;
      });
    } else if (newMode === 'percent') {
      const count = targetMembers.length;
      const eqPct = Number((100 / Math.max(1, count)).toFixed(1));
      let activeIdx = 0;
      group.members.forEach((m) => {
        if (!activeSet.has(m.id)) {
          next[m.id] = 0;
        } else {
          activeIdx++;
          next[m.id] =
            activeIdx === count
              ? Number((100 - eqPct * (count - 1)).toFixed(1))
              : eqPct;
        }
      });
    } else if (newMode === 'exact') {
      const count = targetMembers.length;
      const perPerson = Number((originalTotal / Math.max(1, count)).toFixed(2));
      let activeIdx = 0;
      group.members.forEach((m) => {
        if (!activeSet.has(m.id)) {
          next[m.id] = 0;
        } else {
          activeIdx++;
          next[m.id] =
            activeIdx === count
              ? Number((originalTotal - perPerson * (count - 1)).toFixed(2))
              : perPerson;
        }
      });
    }
    setSplitValues(next);
  };

  const computedSplits = useMemo(() => {
    const items = group.members.map((m) => ({
      memberId: m.id,
      value: splitValues[m.id] ?? 0,
    }));
    return computeSplitAmounts(originalTotal, splitMode, items);
  }, [originalTotal, splitMode, splitValues, group.members]);

  const activeParticipantCount = useMemo(() => {
    return group.members.filter((m) => (splitValues[m.id] || 0) > 0).length;
  }, [group.members, splitValues]);

  const splitSum = useMemo(() => {
    return computedSplits.reduce((s, item) => s + item.calculatedAmount, 0);
  }, [computedSplits]);

  const multiPayerSum = useMemo(() => {
    return Object.values(multiPayers).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  }, [multiPayers]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('請輸入消費項目名稱（例如：敘敘苑燒肉、計程車資）');
      return;
    }
    if (originalTotal <= 0) {
      setErrorMsg('請輸入大於 0 的消費金額');
      return;
    }

    let finalPayers: PayerItem[] = [];
    if (isMultiPayer) {
      finalPayers = group.members
        .map((m) => ({
          memberId: m.id,
          amount: Number((parseFloat(multiPayers[m.id] || '0') || 0).toFixed(2)),
        }))
        .filter((p) => p.amount > 0);

      const diff = Math.abs(multiPayerSum - originalTotal);
      if (diff > 0.5) {
        setErrorMsg(
          `多人墊付總額 (${formatMoney(multiPayerSum, currency)}) 與消費總額 (${formatMoney(
            originalTotal,
            currency
          )}) 不符，相差 ${formatMoney(Math.abs(originalTotal - multiPayerSum), currency)}`
        );
        return;
      }
    } else {
      if (!singlePayerId) {
        setErrorMsg('請選擇誰先墊付');
        return;
      }
      finalPayers = [{ memberId: singlePayerId, amount: originalTotal }];
    }

    const activeCount = computedSplits.filter((s) => s.calculatedAmount > 0).length;
    if (activeCount === 0) {
      setErrorMsg('請至少勾選一位要分攤這筆錢的成員');
      return;
    }

    if (splitMode === 'exact') {
      const diff = Math.abs(splitSum - originalTotal);
      if (diff > 0.5) {
        setErrorMsg(
          `自訂分攤金額加總 (${formatMoney(splitSum, currency)}) 與消費總額 (${formatMoney(
            originalTotal,
            currency
          )}) 不符，尚差 ${formatMoney(originalTotal - splitSum, currency)}`
        );
        return;
      }
    }

    if (splitMode === 'percent') {
      const pctSum = Object.values(splitValues).reduce((s, v) => s + (Number(v) || 0), 0);
      if (Math.abs(pctSum - 100) > 0.5) {
        setErrorMsg(`百分比加總目前為 ${pctSum.toFixed(1)}%，必須等於 100%`);
        return;
      }
    }

    onSave(
      {
        title: title.trim(),
        category,
        date,
        currency,
        exchangeRateToBase: currency === group.baseCurrency ? 1 : rateNum,
        originalAmount: originalTotal,
        baseAmount: baseTotal,
        serviceFeePercent: serviceFeePercent > 0 ? serviceFeePercent : undefined,
        paidBy: finalPayers,
        splitMode,
        splits: computedSplits,
        note: note.trim() || undefined,
      },
      editingExpense?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3E2C1E]/45 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFFDF9] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-2 border-[#3E2C1E] shadow-[0_8px_0_#3E2C1E] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FAF1E2] border-b-2 border-[#E6D4BE] text-[#3E2C1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <QuokkaFaceBadge className="w-8 h-8 shrink-0" />
            <h2 className="text-lg font-extrabold tracking-tight">
              {editingExpense ? '✏️ 編輯分帳項目' : '➕ 新增一筆分帳'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#EADBC8]/60 text-[#5C4432] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {!editingExpense && onSwitchToReceiptScanner && (
            <button
              type="button"
              onClick={onSwitchToReceiptScanner}
              className="w-full p-3.5 rounded-2xl bg-[#FFF6DA] hover:bg-[#FCEEC2] border-2 border-[#E4C77B] text-left flex items-center justify-between gap-3 transition shadow-[0_3px_0_#EAE0D2]"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <BoboFaceBadge className="w-9 h-9" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#B06D3E] border border-[#3E2C1E] text-[#FFFDF9] flex items-center justify-center">
                    <Camera className="w-2.5 h-2.5" />
                  </span>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-[#3E2C1E]">
                    📷 拍收據 / 菜單自動偵測品項與價錢
                  </div>
                  <div className="text-[11px] text-[#7A5E3A]">
                    拍完自動列出所有品項 ➜ 逐項勾選是誰的，或勾選對象整筆平分
                  </div>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#8F4D22] shrink-0">
                開啟掃描 ➜
              </span>
            </button>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#FDF0EE] border-2 border-[#EFC6BF] text-[#A63D32] text-sm font-bold flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#C85A4B]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category Pills */}
          <div>
            <label className="block text-xs font-extrabold text-[#7A624E] uppercase tracking-wider mb-2">
              消費分類
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CATEGORY_META) as ExpenseCategory[])
                .filter((c) => c !== 'settlement')
                .map((catKey) => {
                  const meta = CATEGORY_META[catKey];
                  const active = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                        active
                          ? 'bg-[#FCE394] border-2 border-[#3E2C1E] text-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                          : 'bg-[#FAF6EE] border border-[#E6D6C3] text-[#6E5643] hover:bg-[#F3E8D8]'
                      }`}
                    >
                      <span className="text-lg">{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Title & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#6E5643] mb-1">
                項目名稱 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：首爾烤肉、Uber 車資、幫買伴手禮"
                className="w-full px-3.5 py-2.5 text-sm font-semibold cream-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6E5643] mb-1">
                日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-semibold cream-input"
              />
            </div>
          </div>

          {/* Currency & Amount & Service Fee */}
          <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-[#E6D6C3] space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#6E5643] mb-1">
                  消費幣別
                </label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                  className="w-full px-2.5 py-2.5 text-sm font-bold cream-input"
                >
                  {CURRENCY_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-[#6E5643] mb-1">
                  金額 ({CURRENCIES[currency].symbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rawSubtotal}
                  onChange={(e) => setRawSubtotal(e.target.value)}
                  placeholder="輸入消費金額..."
                  className="w-full px-3.5 py-2.5 text-base font-extrabold cream-input"
                />
              </div>
            </div>

            {/* Service Fee Quick Pills */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-xs font-bold text-[#7A624E]">
                加成計算（服務費 / 消費稅）：
              </span>
              <div className="flex items-center gap-1.5">
                {[0, 5, 8, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setServiceFeePercent(pct)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition ${
                      serviceFeePercent === pct
                        ? 'bg-[#B06D3E] text-[#FFFDF9] border border-[#3E2C1E] shadow-[0_1px_0_#3E2C1E]'
                        : 'bg-[#FFFDF9] border border-[#DFCEB9] text-[#6E5643] hover:bg-[#F3E8D8]'
                    }`}
                  >
                    {pct === 0 ? '不加收' : `+${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-currency Exchange Rate Row */}
            {currency !== group.baseCurrency && (
              <div className="pt-2 border-t border-[#E6D6C3] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[#6E5643]">
                  <span>匯率設定：1 {currency} =</span>
                  <input
                    type="number"
                    step="any"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-24 px-2 py-1 text-xs font-bold cream-input"
                  />
                  <span>{group.baseCurrency}</span>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange(currency)}
                    title="重設為最新匯率"
                    className="p-1 text-[#B06D3E] hover:bg-[#F3E8D8] rounded"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs font-extrabold text-[#8F4D22] bg-[#FCE394]/60 border border-[#E5C97B] px-2.5 py-1 rounded-xl">
                  折合 {formatMoney(baseTotal, group.baseCurrency)}
                </div>
              </div>
            )}

            {serviceFeePercent > 0 && (
              <div className="text-xs text-[#6E5643] flex justify-between pt-1">
                <span>含 +{serviceFeePercent}% 服務費後總計：</span>
                <span className="font-extrabold text-[#3E2C1E]">
                  {formatMoney(originalTotal, currency)}
                </span>
              </div>
            )}
          </div>

          {/* STEP 1: Who Paid (Single vs Multi-Payer) + Exclude Payer Option */}
          <div className="p-4 rounded-2xl bg-[#FDF5E8] border-2 border-[#EAD8C0] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-[#3E2C1E]">
                1️⃣ 誰先付錢（墊付人）？
              </label>
              <button
                type="button"
                onClick={() => setIsMultiPayer(!isMultiPayer)}
                className="text-xs font-extrabold text-[#B06D3E] hover:text-[#8F4D22] flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5" />
                {isMultiPayer ? '切換為單人墊付' : '多人湊錢墊付'}
              </button>
            </div>

            {!isMultiPayer ? (
              <div className="flex flex-wrap gap-2">
                {group.members.map((m, idx) => {
                  const selected = singlePayerId === m.id;
                  const avatarBg = getCreamyAvatarClass(m.avatarColor, idx);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectSinglePayer(m.id)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
                        selected
                          ? 'bg-[#B06D3E] text-[#FFFDF9] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                          : 'bg-[#FFFDF9] text-[#4A3525] border border-[#E2D0BC] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center text-white font-bold ${
                          selected ? 'bg-white/25' : avatarBg
                        }`}
                      >
                        {m.name.slice(0, 1)}
                      </span>
                      <span>{m.name}</span>
                      {selected && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#FFFDF9] border border-[#E5D5C1] space-y-2">
                <div className="flex justify-between text-xs text-[#7A624E] mb-1">
                  <span>輸入每位成員先墊付的金額 ({currency})</span>
                  <span
                    className={
                      Math.abs(multiPayerSum - originalTotal) < 0.5
                        ? 'text-[#3F7A4D] font-extrabold'
                        : 'text-[#B94A3E] font-extrabold'
                    }
                  >
                    已填：{formatMoney(multiPayerSum, currency)} /{' '}
                    {formatMoney(originalTotal, currency)}
                  </span>
                </div>
                {group.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#4A3525]">{m.name}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={multiPayers[m.id] || ''}
                      onChange={(e) =>
                        setMultiPayers({ ...multiPayers, [m.id]: e.target.value })
                      }
                      placeholder="0"
                      className="w-32 px-3 py-1.5 text-sm text-right font-bold cream-input"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* One-tap checkbox: Payer does NOT participate in splitting */}
            <label className="flex items-center gap-2.5 pt-2 border-t border-[#EAD8C0] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludePayerFromSplit}
                onChange={(e) => handleToggleExcludePayer(e.target.checked)}
                className="w-4 h-4 rounded accent-[#B06D3E]"
              />
              <span className="text-xs font-extrabold text-[#5C4432] flex items-center gap-1">
                <UserMinus className="w-3.5 h-3.5 text-[#B06D3E]" />
                先付錢的人不參與這筆分攤（純幫別人代墊 / 請客反扣）
              </span>
            </label>
          </div>

          {/* STEP 2: Who Shares This Expense (Checkboxes + 4 Split Modes) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-xs font-extrabold text-[#3E2C1E]">
                  2️⃣ 勾選誰要負擔這筆錢？（已勾選 {activeParticipantCount} /{' '}
                  {group.members.length} 人）
                </label>
                <p className="text-[11px] text-[#7A624E]">
                  直接點選下方成員即可打勾/取消勾選，只由有打勾的人分攤！
                </p>
              </div>

              {/* Quick Selection Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setExcludePayerFromSplit(false);
                    const next: Record<string, number> = {};
                    group.members.forEach((m) => (next[m.id] = 1));
                    setSplitValues(next);
                    if (splitMode === 'percent' || splitMode === 'exact') {
                      handleSplitModeChange(splitMode);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#F6E8D5] hover:bg-[#EED9BF] text-[#7A441F] text-xs font-extrabold transition"
                >
                  全員平分
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleExcludePayer(true)}
                  className="px-2.5 py-1 rounded-xl bg-[#FCE394]/70 hover:bg-[#FCE394] text-[#4A3525] text-xs font-extrabold transition"
                >
                  排除墊付人
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, number> = {};
                    group.members.forEach((m) => (next[m.id] = 0));
                    setSplitValues(next);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#EFE6DA] hover:bg-[#E5D8C7] text-[#6E5643] text-xs font-bold transition"
                >
                  全部取消
                </button>
              </div>
            </div>

            {/* Split Mode Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-[#F4ECE0] border border-[#E5D5C1] rounded-2xl">
              {(
                [
                  { key: 'equal', label: '勾選平分' },
                  { key: 'exact', label: '自訂金額' },
                  { key: 'shares', label: '比例/份數' },
                  { key: 'percent', label: '百分比 %' },
                ] as { key: SplitMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSplitModeChange(tab.key)}
                  className={`py-2 rounded-xl text-xs font-extrabold transition ${
                    splitMode === tab.key
                      ? 'bg-[#FFFDF9] text-[#8F4D22] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                      : 'text-[#7A624E] hover:text-[#3E2C1E]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Live Per-Person Summary Banner for Equal Split */}
            {splitMode === 'equal' && activeParticipantCount > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-[#EAF4EC] border border-[#BDDAC3] flex items-center justify-between text-xs">
                <span className="font-bold text-[#356340]">
                  ✅ 由已勾選的 {activeParticipantCount} 人平分：
                </span>
                <span className="font-extrabold text-[#2B5936]">
                  每人 {formatMoney(originalTotal / activeParticipantCount, currency)}
                  {currency !== group.baseCurrency &&
                    ` (≈ ${formatMoney(
                      baseTotal / activeParticipantCount,
                      group.baseCurrency
                    )})`}
                </span>
              </div>
            )}

            {/* Validation Status Strip for Exact */}
            {splitMode === 'exact' && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FDF5E8] border border-[#EAD8C0] text-xs">
                <span className="text-[#6E5643] font-semibold">目前分配總額：</span>
                <span
                  className={
                    Math.abs(splitSum - originalTotal) < 0.5
                      ? 'text-[#3F7A4D] font-extrabold'
                      : 'text-[#B94A3E] font-extrabold'
                  }
                >
                  {formatMoney(splitSum, currency)} / {formatMoney(originalTotal, currency)}
                  {Math.abs(splitSum - originalTotal) >= 0.5 &&
                    `（尚差 ${formatMoney(originalTotal - splitSum, currency)}）`}
                </span>
              </div>
            )}

            {/* Member Split Checkbox List */}
            <div className="divide-y divide-[#EFE4D4] border-2 border-[#E5D5C1] rounded-2xl overflow-hidden bg-[#FFFDF9]">
              {group.members.map((m, idx) => {
                const splitEntry = computedSplits.find((s) => s.memberId === m.id);
                const calcAmt = splitEntry?.calculatedAmount || 0;
                const val = splitValues[m.id] ?? 0;
                const isChecked = val > 0;
                const isPayer = currentPayerIds.includes(m.id);
                const avatarBg = getCreamyAvatarClass(m.avatarColor, idx);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (splitMode === 'equal') {
                        handleToggleMemberParticipation(m.id);
                      }
                    }}
                    className={`p-3 flex items-center justify-between gap-2 transition ${
                      splitMode === 'equal' ? 'cursor-pointer' : ''
                    } ${
                      isChecked
                        ? 'bg-[#FFFDF9] hover:bg-[#FAF6EE]'
                        : 'bg-[#FAF6EE]/70 opacity-65 hover:opacity-90'
                    }`}
                  >
                    {/* Left: Checkbox + Avatar + Name + Share Preview */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMemberParticipation(m.id);
                        }}
                        aria-label={`勾選 ${m.name} 是否參與分攤`}
                        className={`p-1 rounded-lg transition ${
                          isChecked
                            ? 'text-[#B06D3E] hover:bg-[#F5E9D8]'
                            : 'text-[#B39B86] hover:bg-[#EFE4D4]'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 fill-[#B06D3E] text-[#FFFDF9]" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div
                        className={`w-7 h-7 rounded-full ${avatarBg} border border-[#3E2C1E]/30 text-white text-xs font-bold flex items-center justify-center shrink-0`}
                      >
                        {m.name.slice(0, 1)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-[#3E2C1E] truncate">
                            {m.name}
                          </span>
                          {isPayer && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#FCE394] border border-[#D8B962] text-[#4A3525] text-[10px] font-extrabold">
                              先墊付
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#7A624E]">
                          {isChecked ? (
                            <span className="text-[#8F4D22] font-bold">
                              應負擔：{formatMoney(calcAmt, currency)}
                              {currency !== group.baseCurrency &&
                                ` (≈ ${formatMoney(
                                  calcAmt * rateNum,
                                  group.baseCurrency
                                )})`}
                            </span>
                          ) : (
                            <span className="text-[#A8927E]">不參與此筆分攤 ($0)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Mode-specific Controls */}
                    {splitMode === 'equal' && (
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1 transition ${
                          isChecked
                            ? 'bg-[#EAF4EC] text-[#356340] border border-[#BDDAC3]'
                            : 'bg-[#EFE6DA] text-[#8C735D]'
                        }`}
                      >
                        {isChecked ? '✓ 分攤' : '不參與'}
                      </span>
                    )}

                    {splitMode === 'exact' && (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs font-bold text-[#8C735D]">
                          {CURRENCIES[currency].symbol}
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={val === 0 ? '' : val}
                          onChange={(e) =>
                            setSplitValues({
                              ...splitValues,
                              [m.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="w-28 px-2.5 py-1.5 text-sm text-right font-extrabold cream-input"
                        />
                      </div>
                    )}

                    {splitMode === 'shares' && (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSplitValues({
                              ...splitValues,
                              [m.id]: Math.max(0, Number((val - 0.5).toFixed(1))),
                            })
                          }
                          className="w-7 h-7 rounded-lg bg-[#EFE6DA] hover:bg-[#E5D8C7] text-[#4A3525] font-extrabold"
                        >
                          -
                        </button>
                        <span className="w-14 text-center text-xs font-extrabold text-[#8F4D22]">
                          {val} 份
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSplitValues({
                              ...splitValues,
                              [m.id]: Number((val + 0.5).toFixed(1)),
                            })
                          }
                          className="w-7 h-7 rounded-lg bg-[#FCE394] hover:bg-[#F8D872] border border-[#3E2C1E] text-[#3E2C1E] font-extrabold"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {splitMode === 'percent' && (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={val === 0 ? '' : val}
                          onChange={(e) =>
                            setSplitValues({
                              ...splitValues,
                              [m.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="w-20 px-2.5 py-1.5 text-sm text-right font-extrabold cream-input"
                        />
                        <span className="text-xs font-bold text-[#7A624E]">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-[#6E5643] mb-1">
              備註（選填）
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：Mona 幫忙代買藥妝、Alice 不喝酒不攤酒錢..."
              className="w-full px-3.5 py-2 text-sm cream-input"
            />
          </div>

          {/* Submit Footer */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-bold text-sm btn-bobo"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-1.5 btn-quokka"
            >
              <Sparkles className="w-4 h-4" />
              {editingExpense ? '儲存修改' : '確認新增帳目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
