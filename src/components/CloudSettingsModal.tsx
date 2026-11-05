import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  MessageSquare,
  Globe,
  RefreshCw,
  Save,
} from 'lucide-react';
import { BillGroup, CurrencyCode } from '../types/bill';
import {
  FirebaseConfigInput,
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
} from '../services/cloudSync';
import { getActiveLiffId, saveCustomLiffId } from '../services/liffService';
import { CURRENCY_LIST, getDefaultExchangeRate } from '../utils/currencies';

interface CloudSettingsModalProps {
  isOpen: boolean;
  group: BillGroup;
  liveRates: Partial<Record<CurrencyCode, number>>;
  onClose: () => void;
  onUpdateGroup: (updated: BillGroup) => void;
  onRefreshLiveRates: () => Promise<void>;
  onCloudConfigChanged: () => void;
}

export const CloudSettingsModal: React.FC<CloudSettingsModalProps> = ({
  isOpen,
  group,
  liveRates,
  onClose,
  onUpdateGroup,
  onRefreshLiveRates,
  onCloudConfigChanged,
}) => {
  const existingFb = getActiveFirebaseConfig();
  const [apiKey, setApiKey] = useState(existingFb?.apiKey || '');
  const [projectId, setProjectId] = useState(existingFb?.projectId || '');
  const [authDomain, setAuthDomain] = useState(existingFb?.authDomain || '');
  const [appId, setAppId] = useState(existingFb?.appId || '');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [liffId, setLiffId] = useState(getActiveLiffId());
  const [customRates, setCustomRates] = useState<Partial<Record<CurrencyCode, number>>>(
    group.customRates || {}
  );
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseFirebaseSnippet = (text: string) => {
    setRawJsonInput(text);
    const extract = (key: string) => {
      const match = text.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
      return match ? match[1] : '';
    };
    const k = extract('apiKey');
    const p = extract('projectId');
    const d = extract('authDomain');
    const a = extract('appId');
    if (k) setApiKey(k);
    if (p) setProjectId(p);
    if (d) setAuthDomain(d);
    if (a) setAppId(a);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim() && projectId.trim()) {
      const cfg: FirebaseConfigInput = {
        apiKey: apiKey.trim(),
        projectId: projectId.trim(),
        authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
        appId: appId.trim() || undefined,
      };
      saveCustomFirebaseConfig(cfg);
    } else {
      saveCustomFirebaseConfig(null);
    }

    saveCustomLiffId(liffId);
    onUpdateGroup({
      ...group,
      customRates,
      updatedAt: Date.now(),
    });
    onCloudConfigChanged();
    setSavedNotice('✅ 設定已儲存並套用！');
    setTimeout(() => {
      setSavedNotice(null);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold">⚙️ 雲端同步、LINE LIFF 與匯率設定</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveAll} className="p-5 overflow-y-auto space-y-6 flex-1">
          {savedNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Section 1: Multi-currency Custom Rates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  1. 出國多幣別匯率設定（基準幣：{group.baseCurrency}）
                </h3>
              </div>
              <button
                type="button"
                disabled={isRefreshingRates}
                onClick={async () => {
                  setIsRefreshingRates(true);
                  await onRefreshLiveRates();
                  setIsRefreshingRates(false);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingRates ? 'animate-spin' : ''}`}
                />
                更新即時匯率
              </button>
            </div>
            <p className="text-xs text-slate-500">
              可為本群組鎖定固定旅遊匯率（例如日幣固定算 0.215），留空則自動採用即時匯率：
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CURRENCY_LIST.filter((c) => c.code !== group.baseCurrency).map((c) => {
                const defaultVal =
                  liveRates[c.code] || getDefaultExchangeRate(c.code, group.baseCurrency);
                return (
                  <div
                    key={c.code}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="text-xs font-bold text-slate-700 mb-1">
                      {c.flag} 1 {c.code} = ? {group.baseCurrency}
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={customRates[c.code] ?? ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const next = { ...customRates };
                        if (!e.target.value || isNaN(val)) {
                          delete next[c.code];
                        } else {
                          next[c.code] = val;
                        }
                        setCustomRates(next);
                      }}
                      placeholder={`即時 ${defaultVal}`}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section 2: Firebase Cloud Realtime Sync */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                2. Firebase Firestore 雲端即時共同編輯（選填）
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              至 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Firebase Console</a> 建立免費專案並啟用 <strong>Cloud Firestore</strong> 後，可直接把 <code>firebaseConfig</code> 貼在下方，自動解析：
            </p>
            <textarea
              rows={3}
              value={rawJsonInput}
              onChange={(e) => handleParseFirebaseSnippet(e.target.value)}
              placeholder={`直接貼上 Firebase SDK 片段，例如：\nconst firebaseConfig = { apiKey: "AIza...", projectId: "my-split-app" };`}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Firebase apiKey
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Firebase projectId
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-bill-split-id"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section 3: LINE LIFF SDK */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#06C755]" />
              <h3 className="text-sm font-bold text-slate-900">
                3. LINE LIFF ID 整合（選填）
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              若在 LINE Developers 建立 LIFF App 並將 Endpoint URL 指向妳的 GitHub Pages 網址，填入 LIFF ID 後即可在 LINE 內自動帶入個人頭像與發送 Flex Message 卡片：
            </p>
            <input
              type="text"
              value={liffId}
              onChange={(e) => setLiffId(e.target.value)}
              placeholder="例如：2001234567-AbCdEfGh"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-semibold text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              儲存設定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
