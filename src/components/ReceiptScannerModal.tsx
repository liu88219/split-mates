import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Check,
  KeyRound,
  AlertCircle,
  Receipt,
  Users,
  UserMinus,
  Loader2,
} from 'lucide-react';
import {
  BillGroup,
  CurrencyCode,
  Expense,
  ExpenseCategory,
} from '../types/bill';
import {
  CATEGORY_META,
  CURRENCY_LIST,
  formatMoney,
  getDefaultExchangeRate,
} from '../utils/currencies';
import { computeSplitAmounts } from '../utils/settlement';
import {
  DetectedReceiptItem,
  getSavedGeminiApiKey,
  recognizeReceiptImage,
  saveGeminiApiKey,
} from '../utils/receiptOcr';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  group: BillGroup;
  liveRates: Partial<Record<CurrencyCode, number>>;
  onClose: () => void;
  onSaveExpenses: (expensesToCreate: Array<Omit<Expense, 'id' | 'createdAt'>>) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  group,
  liveRates,
  onClose,
  onSaveExpenses,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [usedEngine, setUsedEngine] = useState<'gemini-vision' | 'local-ocr' | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optional Gemini API Key settings drawer
  const [showAiKeyPanel, setShowAiKeyPanel] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getSavedGeminiApiKey());
  const [hasSavedAiKey, setHasSavedAiKey] = useState(() =>
    Boolean(getSavedGeminiApiKey())
  );

  // Receipt metadata
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<CurrencyCode>(group.baseCurrency);
  const [serviceFeePercent, setServiceFeePercent] = useState<number>(0);
  const [payerId, setPayerId] = useState<string>(group.members[0]?.id || '');

  // Detected items
  const [items, setItems] = useState<DetectedReceiptItem[]>([]);

  // Splitting mode:
  // 'itemized' -> 逐項勾選每道品項是誰的
  // 'whole_equal' -> 整筆收據總額平分（勾選平分對象）
  const [assignMode, setAssignMode] = useState<'itemized' | 'whole_equal'>('itemized');
  const [wholeEqualMemberIds, setWholeEqualMemberIds] = useState<string[]>([]);
  const [excludePayerInWholeEqual, setExcludePayerInWholeEqual] = useState(false);
  const [saveAsSeparateExpenses, setSaveAsSeparateExpenses] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl(null);
    setIsScanning(false);
    setScanStatus('');
    setScanProgress(0);
    setUsedEngine(null);
    setErrorMsg(null);
    setTitle('');
    setCategory('food');
    setDate(new Date().toISOString().slice(0, 10));
    setCurrency(group.baseCurrency);
    setServiceFeePercent(0);
    setPayerId(group.members[0]?.id || '');
    setItems([]);
    setAssignMode('itemized');
    setWholeEqualMemberIds(group.members.map((m) => m.id));
    setExcludePayerInWholeEqual(false);
    setSaveAsSeparateExpenses(false);
    const savedKey = getSavedGeminiApiKey();
    setGeminiKeyInput(savedKey);
    setHasSavedAiKey(Boolean(savedKey));
  }, [isOpen, group]);

  const exchangeRateToBase = useMemo(() => {
    if (currency === group.baseCurrency) return 1;
    const custom = group.customRates?.[currency];
    const live = liveRates?.[currency];
    return custom || live || getDefaultExchangeRate(currency, group.baseCurrency);
  }, [currency, group.baseCurrency, group.customRates, liveRates]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    setIsScanning(true);
    setScanProgress(0.08);
    setScanStatus('📷 正在讀取收據照片...');

    try {
      const result = await recognizeReceiptImage(file, (status, ratio) => {
        setScanStatus(status);
        setScanProgress(ratio);
      });

      setUsedEngine(result.engine);
      if (result.storeName && !title) {
        setTitle(result.storeName);
      } else if (!title) {
        setTitle('收據掃描分帳');
      }
      if (result.currency) {
        setCurrency(result.currency);
      }
      if (typeof result.serviceFeePercent === 'number' && result.serviceFeePercent > 0) {
        setServiceFeePercent(result.serviceFeePercent);
      }

      const allMemberIds = group.members.map((m) => m.id);
      if (result.items.length > 0) {
        setItems(
          result.items.map((it, idx) => ({
            id: `rcpt-item-${Date.now()}-${idx}`,
            name: it.name,
            quantity: it.quantity || 1,
            amount: it.amount,
            selected: true,
            // Default: all members checked so user can either uncheck or tap a single person
            assignedMemberIds: [...allMemberIds],
          }))
        );
      } else {
        // Provide 2 editable blank rows if OCR couldn't confidently parse structured lines
        setItems([
          {
            id: `rcpt-item-${Date.now()}-0`,
            name: '品項 1',
            quantity: 1,
            amount: 0,
            selected: true,
            assignedMemberIds: [...allMemberIds],
          },
        ]);
        setErrorMsg(
          '⚠️ 照片字跡較模糊或格式特殊，未能自動抓出完整價格，您可直接在下方手動輸入品項或開啟「AI 超精準辨識」！'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '辨識收據時發生錯誤，請重試或手動新增品項'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveAiKey = () => {
    saveGeminiApiKey(geminiKeyInput);
    const saved = Boolean(getSavedGeminiApiKey());
    setHasSavedAiKey(saved);
    setShowAiKeyPanel(false);
  };

  const handleAddBlankItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `rcpt-item-${Date.now()}-${prev.length}`,
        name: '',
        quantity: 1,
        amount: 0,
        selected: true,
        assignedMemberIds: group.members.map((m) => m.id),
      },
    ]);
  };

  const handleUpdateItem = (
    itemId: string,
    patch: Partial<DetectedReceiptItem>
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleToggleItemMember = (itemId: string, memberId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.assignedMemberIds.includes(memberId);
        const nextIds = exists
          ? it.assignedMemberIds.filter((id) => id !== memberId)
          : [...it.assignedMemberIds, memberId];
        return { ...it, assignedMemberIds: nextIds };
      })
    );
  };

  const handleSelectOnlyMemberForItem = (itemId: string, memberId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, assignedMemberIds: [memberId] } : it
      )
    );
  };

  const handleSelectAllMembersForItem = (itemId: string) => {
    const allIds = group.members.map((m) => m.id);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, assignedMemberIds: allIds } : it
      )
    );
  };

  const handleClearMembersForItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, assignedMemberIds: [] } : it
      )
    );
  };

  const handleToggleWholeEqualMember = (memberId: string) => {
    setWholeEqualMemberIds((prev) => {
      const exists = prev.includes(memberId);
      const next = exists
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];
      if (memberId === payerId) {
        setExcludePayerInWholeEqual(!next.includes(payerId));
      }
      return next;
    });
  };

  const handleToggleExcludePayerWholeEqual = (exclude: boolean) => {
    setExcludePayerInWholeEqual(exclude);
    if (exclude) {
      const others = wholeEqualMemberIds.filter((id) => id !== payerId);
      if (others.length > 0) {
        setWholeEqualMemberIds(others);
      } else {
        setWholeEqualMemberIds(
          group.members.filter((m) => m.id !== payerId).map((m) => m.id)
        );
      }
    } else if (!wholeEqualMemberIds.includes(payerId)) {
      setWholeEqualMemberIds([...wholeEqualMemberIds, payerId]);
    }
  };

  const selectedItems = useMemo(
    () => items.filter((it) => it.selected && (Number(it.amount) || 0) > 0),
    [items]
  );

  const itemsSubtotal = useMemo(
    () =>
      Number(
        selectedItems
          .reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
          .toFixed(2)
      ),
    [selectedItems]
  );

  const grandTotal = useMemo(
    () => Number((itemsSubtotal * (1 + serviceFeePercent / 100)).toFixed(2)),
    [itemsSubtotal, serviceFeePercent]
  );

  // Per-member calculated breakdown
  const memberTotals = useMemo(() => {
    const map: Record<string, number> = {};
    group.members.forEach((m) => {
      map[m.id] = 0;
    });

    if (selectedItems.length === 0) return map;

    if (assignMode === 'whole_equal') {
      const activeSet = new Set(wholeEqualMemberIds);
      const rawSplits = group.members.map((m) => ({
        memberId: m.id,
        value: activeSet.has(m.id) ? 1 : 0,
      }));
      const computed = computeSplitAmounts(grandTotal, 'equal', rawSplits);
      computed.forEach((s) => {
        map[s.memberId] = s.calculatedAmount;
      });
      return map;
    }

    // Itemized mode: calculate each item's exact split (with penny remainder fairness + service fee)
    const feeMultiplier = 1 + serviceFeePercent / 100;
    for (const item of selectedItems) {
      if (item.assignedMemberIds.length === 0) continue;
      const itemWithFee = Number((item.amount * feeMultiplier).toFixed(2));
      const activeSet = new Set(item.assignedMemberIds);
      const itemSplits = group.members.map((m) => ({
        memberId: m.id,
        value: activeSet.has(m.id) ? 1 : 0,
      }));
      const computed = computeSplitAmounts(itemWithFee, 'equal', itemSplits);
      computed.forEach((s) => {
        map[s.memberId] = Number(((map[s.memberId] || 0) + s.calculatedAmount).toFixed(2));
      });
    }

    // Reconcile any rounding penny difference so sum(memberTotals) === grandTotal
    const assignedSum = Object.values(map).reduce((s, v) => s + v, 0);
    const diff = Number((grandTotal - assignedSum).toFixed(2));
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.5) {
      const firstActiveMember = group.members.find((m) => (map[m.id] || 0) > 0);
      if (firstActiveMember) {
        map[firstActiveMember.id] = Number(
          (map[firstActiveMember.id] + diff).toFixed(2)
        );
      }
    }

    return map;
  }, [
    group.members,
    selectedItems,
    assignMode,
    wholeEqualMemberIds,
    grandTotal,
    serviceFeePercent,
  ]);

  const handleConfirmImport = () => {
    setErrorMsg(null);
    if (selectedItems.length === 0) {
      setErrorMsg('請至少勾選 1 個金額大於 0 的品項');
      return;
    }
    if (!payerId) {
      setErrorMsg('請選擇誰先墊付這筆收據');
      return;
    }

    if (assignMode === 'whole_equal') {
      if (wholeEqualMemberIds.length === 0) {
        setErrorMsg('請至少勾選 1 位參與平分的好友');
        return;
      }
      const activeSet = new Set(wholeEqualMemberIds);
      const splits = computeSplitAmounts(
        grandTotal,
        'equal',
        group.members.map((m) => ({
          memberId: m.id,
          value: activeSet.has(m.id) ? 1 : 0,
        }))
      );
      const itemSummary = selectedItems
        .map((it) => `${it.name || '品項'} $${it.amount}`)
        .join('、');

      onSaveExpenses([
        {
          title: title.trim() || '收據掃描分帳',
          category,
          date,
          currency,
          exchangeRateToBase,
          originalAmount: grandTotal,
          baseAmount: Number((grandTotal * exchangeRateToBase).toFixed(2)),
          serviceFeePercent: serviceFeePercent > 0 ? serviceFeePercent : undefined,
          paidBy: [{ memberId: payerId, amount: grandTotal }],
          splitMode: 'equal',
          splits,
          note: `📷 收據品項 (${selectedItems.length}項)：${itemSummary}`,
        },
      ]);
      onClose();
      return;
    }

    // Itemized mode validation: every selected item must have >= 1 assigned member
    const unassignedItem = selectedItems.find(
      (it) => it.assignedMemberIds.length === 0
    );
    if (unassignedItem) {
      setErrorMsg(`請勾選「${unassignedItem.name || '未命名品項'}」是由誰分攤！`);
      return;
    }

    const feeMultiplier = 1 + serviceFeePercent / 100;

    if (saveAsSeparateExpenses) {
      const expensesList: Array<Omit<Expense, 'id' | 'createdAt'>> = selectedItems.map(
        (it) => {
          const itemTotal = Number((it.amount * feeMultiplier).toFixed(2));
          const activeSet = new Set(it.assignedMemberIds);
          const splits = computeSplitAmounts(
            itemTotal,
            'equal',
            group.members.map((m) => ({
              memberId: m.id,
              value: activeSet.has(m.id) ? 1 : 0,
            }))
          );
          return {
            title: title.trim()
              ? `${title.trim()} — ${it.name || '品項'}`
              : it.name || '收據品項',
            category,
            date,
            currency,
            exchangeRateToBase,
            originalAmount: itemTotal,
            baseAmount: Number((itemTotal * exchangeRateToBase).toFixed(2)),
            serviceFeePercent: serviceFeePercent > 0 ? serviceFeePercent : undefined,
            paidBy: [{ memberId: payerId, amount: itemTotal }],
            splitMode: 'equal',
            splits,
            note: '📷 收據掃描逐項拆單',
          };
        }
      );
      onSaveExpenses(expensesList);
      onClose();
      return;
    }

    // Combined 1 expense with exact per-member itemized totals
    const splits = group.members.map((m) => ({
      memberId: m.id,
      value: memberTotals[m.id] || 0,
      calculatedAmount: memberTotals[m.id] || 0,
    }));

    const itemBreakdownText = selectedItems
      .map((it) => {
        const names = it.assignedMemberIds
          .map((id) => group.members.find((m) => m.id === id)?.name || '')
          .filter(Boolean);
        const whoText =
          names.length === group.members.length ? '全員' : names.join('/');
        return `${it.name || '品項'} $${it.amount}(${whoText})`;
      })
      .join('、');

    onSaveExpenses([
      {
        title: title.trim() || '收據掃描分帳',
        category,
        date,
        currency,
        exchangeRateToBase,
        originalAmount: grandTotal,
        baseAmount: Number((grandTotal * exchangeRateToBase).toFixed(2)),
        serviceFeePercent: serviceFeePercent > 0 ? serviceFeePercent : undefined,
        paidBy: [{ memberId: payerId, amount: grandTotal }],
        splitMode: 'exact',
        splits,
        note: `📷 收據逐項分帳：${itemBreakdownText}`,
      },
    ]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold leading-tight">
                📷 拍收據 / 菜單自動偵測品項分帳
              </h2>
              <p className="text-[11px] text-indigo-100">
                自動辨識所有品項與價錢 ➜ 自由勾選哪道是誰吃的，或整筆勾選平分對象
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Inputs for Camera & Photo Album */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* AI Vision Mode Bar */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <Sparkles
                  className={`w-4 h-4 ${
                    hasSavedAiKey ? 'text-violet-600' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold text-slate-800">
                  {hasSavedAiKey
                    ? '✨ 已啟用 Gemini AI 智慧視覺超精準辨識'
                    : '🔍 目前使用：內建免設定 OCR 辨識引擎'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiKeyPanel((v) => !v)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{hasSavedAiKey ? '修改 AI 金鑰' : '升級 AI 超精準辨識 (選填)'}</span>
              </button>
            </div>

            {showAiKeyPanel && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  貼上免費的 Google AI Studio <code>Gemini API Key</code>（僅儲存在妳這台裝置瀏覽器本機，不會上傳至公開程式碼），即可秒速精準辨識歪斜熱感紙收據、手寫單與日韓文菜單！留空則使用內建免費 OCR。
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="貼上 AIza... 開頭的 Gemini API Key（可留空）"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAiKey}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                  >
                    儲存
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 1: Capture / Upload Buttons */}
          {!previewUrl && !isScanning && items.length === 0 && (
            <div className="p-6 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  拍下收據、發票明細或點餐單
                </h3>
                <p className="text-xs text-slate-500">
                  支援餐廳結帳單、台灣電子發票明細、外送截圖、日本超市/居酒屋收據
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>📷 直接拍照掃描</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                >
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>🖼️ 從相簿選照片 / 截圖</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddBlankItem}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 underline"
              >
                沒有照片？直接手動逐項輸入品項分帳
              </button>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div className="text-sm font-bold text-indigo-950">{scanStatus}</div>
              <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-300"
                  style={{ width: `${Math.max(8, Math.round(scanProgress * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 2 & 3: Detected Items + Assignment UI */}
          {!isScanning && (previewUrl || items.length > 0) && (
            <div className="space-y-4">
              {/* Top Receipt Summary & Re-upload */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="收據預覽"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 shrink-0"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900">
                        共偵測到 {items.length} 個品項
                      </span>
                      {usedEngine && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                          {usedEngine === 'gemini-vision' ? '✨ AI 視覺' : '🔍 本機 OCR'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      品項名稱或價錢若有誤差可直接點擊數字修改
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    重拍
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    換圖
                  </button>
                </div>
              </div>

              {/* Store Title, Category, Currency, Service Fee & Payer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    帳目 / 店家名稱
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：居酒屋晚餐、超市採買"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    幣別 & 類別
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                      className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      {(Object.keys(CATEGORY_META) as ExpenseCategory[])
                        .filter((k) => k !== 'settlement')
                        .map((catKey) => (
                          <option key={catKey} value={catKey}>
                            {CATEGORY_META[catKey].emoji} {CATEGORY_META[catKey].label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Who Paid + Service Fee */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    💳 這張單由誰先刷卡/付現墊付？
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      服務費：
                    </span>
                    {[0, 10].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setServiceFeePercent(pct)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition ${
                          serviceFeePercent === pct
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-600'
                        }`}
                      >
                        {pct === 0 ? '無 (0%)' : '+10%'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((m) => {
                    const active = payerId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPayerId(m.id);
                          if (excludePayerInWholeEqual) {
                            setWholeEqualMemberIds(
                              group.members
                                .filter((mem) => mem.id !== m.id)
                                .map((mem) => mem.id)
                            );
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{m.name}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split Mode Switcher: 逐項勾選是誰的 vs 整筆平分勾選對象 */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800">
                  🎯 選擇分攤方式：
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setAssignMode('itemized')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      assignMode === 'itemized'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>逐項勾選哪筆是誰的</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode('whole_equal')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      assignMode === 'whole_equal'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>整筆總額平分 (勾選對象)</span>
                  </button>
                </div>
              </div>

              {/* Detected Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    📋 品項與價錢清單（共勾選 {selectedItems.length} 項，小計{' '}
                    {formatMoney(itemsSubtotal, currency)}）
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBlankItem}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增品項
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((item) => {
                    const perPersonItemShare =
                      item.assignedMemberIds.length > 0
                        ? Math.round(item.amount / item.assignedMemberIds.length)
                        : 0;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition space-y-2.5 ${
                          item.selected
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-slate-50 border-slate-200 opacity-55'
                        }`}
                      >
                        {/* Item Row: Checkbox + Name + Price + Delete */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItem(item.id, { selected: !item.selected })
                            }
                            className="text-indigo-600 shrink-0"
                            title={item.selected ? '取消計入此品項' : '計入此品項'}
                          >
                            {item.selected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { name: e.target.value })
                            }
                            placeholder="品項名稱"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />

                          <div className="relative w-28 shrink-0">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.amount || ''}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  amount: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="價錢"
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-right text-sm font-extrabold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                            title="移除此列"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Member Assignment Chips (Shown when assignMode === 'itemized' and item is selected) */}
                        {assignMode === 'itemized' && item.selected && (
                          <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {group.members.map((m) => {
                                const checked = item.assignedMemberIds.includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleToggleItemMember(item.id, m.id)}
                                    onDoubleClick={() =>
                                      handleSelectOnlyMemberForItem(item.id, m.id)
                                    }
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 border transition ${
                                      checked
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {checked ? (
                                      <CheckSquare className="w-3 h-3" />
                                    ) : (
                                      <Square className="w-3 h-3 opacity-60" />
                                    )}
                                    <span>{m.name}</span>
                                  </button>
                                );
                              })}

                              <button
                                type="button"
                                onClick={() =>
                                  item.assignedMemberIds.length === group.members.length
                                    ? handleClearMembersForItem(item.id)
                                    : handleSelectAllMembersForItem(item.id)
                                }
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                              >
                                {item.assignedMemberIds.length === group.members.length
                                  ? '全不選'
                                  : '全選'}
                              </button>
                            </div>

                            <span className="text-[11px] font-bold text-slate-500">
                              {item.assignedMemberIds.length === 0 ? (
                                <span className="text-rose-600">請勾選分攤人</span>
                              ) : item.assignedMemberIds.length === 1 ? (
                                `${
                                  group.members.find(
                                    (m) => m.id === item.assignedMemberIds[0]
                                  )?.name || ''
                                } 單獨負擔`
                              ) : (
                                `${item.assignedMemberIds.length} 人分 · 約 ${formatMoney(
                                  perPersonItemShare,
                                  currency
                                )}/人`
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Whole-Receipt Equal Split Member Selector */}
              {assignMode === 'whole_equal' && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-extrabold text-indigo-950">
                      👥 勾選要一起平分整張收據（{formatMoney(grandTotal, currency)}）的對象：
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setWholeEqualMemberIds(group.members.map((m) => m.id))
                        }
                        className="px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700"
                      >
                        全選
                      </button>
                      <button
                        type="button"
                        onClick={() => setWholeEqualMemberIds([])}
                        className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600"
                      >
                        清空
                      </button>
                    </div>
                  </div>

                  {/* Exclude payer quick toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleExcludePayerWholeEqual(!excludePayerInWholeEqual)
                    }
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition ${
                      excludePayerInWholeEqual
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <UserMinus className="w-4 h-4 text-amber-600" />
                      <span>先付錢的人不參與這筆平分（純幫大家代墊）</span>
                    </span>
                    {excludePayerInWholeEqual ? (
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.members.map((m) => {
                      const checked = wholeEqualMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleWholeEqualMember(m.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className="text-xs font-bold truncate">{m.name}</span>
                          <span className="text-xs font-extrabold">
                            {checked
                              ? formatMoney(memberTotals[m.id] || 0, currency)
                              : '$0'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Per-Person Calculation Preview */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-200">
                    🧮 每人應分攤金額即時預覽
                    {serviceFeePercent > 0 ? `（含 +${serviceFeePercent}% 服務費）` : ''}
                  </span>
                  <span className="font-extrabold text-sky-300 text-sm">
                    總計 {formatMoney(grandTotal, currency)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.members.map((m) => {
                    const amt = memberTotals[m.id] || 0;
                    return (
                      <div
                        key={m.id}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs ${
                          amt > 0 ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        <span className="font-semibold truncate">{m.name}</span>
                        <span className="font-extrabold text-emerald-300">
                          {formatMoney(amt, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {assignMode === 'itemized' && selectedItems.length > 1 && (
                  <label className="pt-2 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsSeparateExpenses}
                      onChange={(e) => setSaveAsSeparateExpenses(e.target.checked)}
                      className="rounded text-indigo-500"
                    />
                    <span>
                      將每個品項拆成 {selectedItems.length}{' '}
                      筆獨立帳目存入（預設不勾選：合併存為 1 筆總帳並自動附上完整品項明細）
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold transition"
          >
            取消
          </button>
          {(previewUrl || items.length > 0) && !isScanning && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>確認寫入分帳本 ({formatMoney(grandTotal, currency)})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
