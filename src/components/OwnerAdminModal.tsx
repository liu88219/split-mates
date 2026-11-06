import React, { useState } from 'react';
import {
  X,
  Crown,
  FolderOpen,
  Archive,
  ArchiveRestore,
  Plus,
  Edit3,
  Trash2,
  Settings,
  Lock,
  Unlock,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  Download,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import LZString from 'lz-string';
import { BillGroup } from '../types/bill';
import { formatMoney } from '../utils/currencies';
import {
  exportAllGroupsJson,
  parseImportedGroupsJson,
} from '../services/cloudSync';

const OWNER_UNLOCKED_KEY = 'splitmates_owner_unlocked_v2';
const OWNER_PASSHASH_KEY = 'splitmates_owner_passhash_v1';

async function hashPasscode(raw: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`splitmates:${raw}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  const str = `splitmates:${raw}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv:${(h >>> 0).toString(16)}`;
}

function getSavedPasshash(): string | null {
  try {
    return localStorage.getItem(OWNER_PASSHASH_KEY);
  } catch {
    return null;
  }
}

export function isOwnerUnlockedOnDevice(): boolean {
  try {
    return (
      Boolean(localStorage.getItem(OWNER_PASSHASH_KEY)) &&
      localStorage.getItem(OWNER_UNLOCKED_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

export function setOwnerUnlockedOnDevice(unlocked: boolean): void {
  try {
    if (unlocked) {
      localStorage.setItem(OWNER_UNLOCKED_KEY, 'true');
    } else {
      localStorage.removeItem(OWNER_UNLOCKED_KEY);
    }
  } catch {
    // ignore
  }
}

interface OwnerAdminModalProps {
  isOpen: boolean;
  groups: BillGroup[];
  activeGroup: BillGroup;
  onClose: () => void;
  onSelectGroup: (groupId: string) => void;
  onOpenNewGroup: () => void;
  onOpenEditGroup: () => void;
  onToggleArchiveGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onOpenCloudSettings: () => void;
  onRestoreGroupFromUrl: (restored: BillGroup) => void;
  onImportGroupsBackup?: (importedGroups: BillGroup[]) => void;
  onOwnerPasscodeSynced?: () => void;
}

export const OwnerAdminModal: React.FC<OwnerAdminModalProps> = ({
  isOpen,
  groups,
  activeGroup,
  onClose,
  onSelectGroup,
  onOpenNewGroup,
  onOpenEditGroup,
  onToggleArchiveGroup,
  onDeleteGroup,
  onOpenCloudSettings,
  onRestoreGroupFromUrl,
  onImportGroupsBackup,
  onOwnerPasscodeSynced,
}) => {
  const [hasPasshash, setHasPasshash] = useState<boolean>(() => Boolean(getSavedPasshash()));
  const [unlocked, setUnlocked] = useState<boolean>(() => isOwnerUnlockedOnDevice());
  const [isSettingNewPin, setIsSettingNewPin] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'archived' | 'restore'>('active');
  const [restoreUrlInput, setRestoreUrlInput] = useState('');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeTrips = groups.filter((g) => !g.isArchived);
  const archivedTrips = groups.filter((g) => Boolean(g.isArchived));

  const handleSetPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    const confirmClean = confirmPinInput.trim();
    if (clean.length < 4) {
      setPinError('請輸入至少 4 碼的管理密碼');
      return;
    }
    if (clean !== confirmClean) {
      setPinError('兩次輸入的密碼不一致，請重新確認');
      return;
    }
    const hashed = await hashPasscode(clean);
    try {
      localStorage.setItem(OWNER_PASSHASH_KEY, hashed);
    } catch {
      // ignore
    }
    setHasPasshash(true);
    setUnlocked(true);
    setIsSettingNewPin(false);
    setOwnerUnlockedOnDevice(true);
    setPinError(null);
    setPinInput('');
    setConfirmPinInput('');
    onOwnerPasscodeSynced?.();
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    const savedHash = getSavedPasshash();
    if (!savedHash) {
      setHasPasshash(false);
      return;
    }
    const candidateHash = await hashPasscode(clean);
    if (candidateHash === savedHash) {
      setUnlocked(true);
      setOwnerUnlockedOnDevice(true);
      setPinError(null);
      setPinInput('');
      onOwnerPasscodeSynced?.();
    } else {
      setPinError('密碼不正確，請重新輸入');
    }
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreMsg(null);
    const raw = restoreUrlInput.trim();
    if (!raw) return;

    try {
      let sParam: string | null = null;
      if (raw.includes('s=')) {
        const queryIdx = raw.indexOf('?');
        const params = new URLSearchParams(
          queryIdx !== -1 ? raw.slice(queryIdx) : raw
        );
        sParam = params.get('s');
      } else {
        sParam = raw;
      }

      if (sParam) {
        const json = LZString.decompressFromEncodedURIComponent(sParam);
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed && parsed.id && Array.isArray(parsed.members)) {
            onRestoreGroupFromUrl(parsed as BillGroup);
            setRestoreUrlInput('');
            setRestoreMsg(`✅ 成功還原群組「${parsed.name}」！`);
            setTimeout(() => {
              setRestoreMsg(null);
              onClose();
            }, 1000);
            return;
          }
        }
      }
      setRestoreMsg('⚠️ 無法從此連結解析出帳本資料，請確認連結內含 ?group=...&s=... 參數');
    } catch {
      setRestoreMsg('⚠️ 連結格式無法解析');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold">
              👑 我的分帳本管理後台（僅管理員可見）
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {unlocked && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingNewPin((v) => !v);
                    setPinError(null);
                    setPinInput('');
                    setConfirmPinInput('');
                  }}
                  title="修改本機管理密碼"
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 flex items-center gap-1 transition"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>改密碼</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlocked(false);
                    setIsSettingNewPin(false);
                    setOwnerUnlockedOnDevice(false);
                  }}
                  title="鎖定管理後台"
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 flex items-center gap-1 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>上鎖</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Password Setup or Unlock Gate */}
        {!hasPasshash || isSettingNewPin ? (
          <form onSubmit={handleSetPasscode} className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {hasPasshash ? '修改本機管理密碼' : '首次啟用：設定本機管理密碼'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                密碼以 SHA-256 加密雜湊後僅儲存於本機；在「桌面主畫面 App」與「Safari / 電腦」設定相同的管理密碼，即可自動跨瀏覽器同步妳所有的分帳群組：
              </p>
            </div>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                {pinError}
              </div>
            )}

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="設定新管理密碼（至少 4 碼）"
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-center text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <input
              type="password"
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value)}
              placeholder="再次輸入新管理密碼確認"
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-center text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <div className="flex gap-2">
              {hasPasshash && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingNewPin(false);
                    setPinError(null);
                  }}
                  className="flex-1 py-3 rounded-2xl border border-slate-300 text-slate-700 font-bold text-sm"
                >
                  取消
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                儲存密碼並解鎖
              </button>
            </div>
          </form>
        ) : !unlocked ? (
          <form onSubmit={handleUnlock} className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                管理員專屬區域
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                為避免其他朋友看到或誤觸其他群組，請輸入妳在此裝置設定的管理密碼解鎖：
              </p>
            </div>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                {pinError}
              </div>
            )}

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="請輸入管理員密碼"
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-center text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-4 h-4" />
              解鎖我的所有分帳群組
            </button>
          </form>
        ) : (
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {/* Current Active Group Quick Management Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">
                  目前畫面顯示的群組：
                </span>
                {activeGroup.isArchived && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                    📦 已封存
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  {activeGroup.coverImageUrl ? (
                    <img
                      src={activeGroup.coverImageUrl}
                      alt={activeGroup.name}
                      className="w-10 h-10 rounded-2xl object-cover border border-indigo-300"
                    />
                  ) : (
                    <span className="text-2xl">{activeGroup.coverEmoji}</span>
                  )}
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {activeGroup.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {activeGroup.members.length} 位成員 · {activeGroup.expenses.length} 筆消費
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEditGroup();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    改名 / 換圖 / 刪除
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleArchiveGroup(activeGroup.id)}
                    className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1 transition"
                  >
                    {activeGroup.isArchived ? (
                      <>
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        還原
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        結束封存
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-Tabs: 進行中旅程 / 歷史封存區 / 還原舊連結 */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                  tab === 'active'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>進行中 ({activeTrips.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('archived')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                  tab === 'archived'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>歷史封存 ({archivedTrips.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('restore')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                  tab === 'restore'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>備份 / 還原</span>
              </button>
            </div>

            {/* Tab 1 & 2: Active or Archived Groups List */}
            {(tab === 'active' || tab === 'archived') && (
              <div className="space-y-2.5">
                {(tab === 'active' ? activeTrips : archivedTrips).length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    {tab === 'active'
                      ? '目前沒有進行中的旅程，請點下方「＋建立新分帳群組」'
                      : '📦 目前沒有已封存的歷史旅程（旅程結束後可點「結束封存」收進這裡）'}
                  </div>
                ) : (
                  (tab === 'active' ? activeTrips : archivedTrips).map((g) => {
                    const isCurrent = g.id === activeGroup.id;
                    const total = g.expenses.reduce((s, e) => s + e.baseAmount, 0);
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          onSelectGroup(g.id);
                          onClose();
                        }}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isCurrent
                            ? 'bg-indigo-50/60 border-indigo-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {g.coverImageUrl ? (
                            <img
                              src={g.coverImageUrl}
                              alt={g.name}
                              className="w-10 h-10 rounded-2xl object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                              {g.coverEmoji}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {g.name}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                                  顯示中
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {g.members.length} 人 · {g.expenses.length} 筆 · 共{' '}
                              {formatMoney(Math.round(total), g.baseCurrency)}
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleArchiveGroup(g.id)}
                            title={g.isArchived ? '還原回進行中' : '移至歷史封存區'}
                            className="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                          >
                            {g.isArchived ? (
                              <ArchiveRestore className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteGroup(g.id)}
                            title={`刪除「${g.name}」`}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 3: Permanent Backup (.json) & Restore Group from Shared URL */}
            {tab === 'restore' && (
              <div className="space-y-4">
                {/* 1-Click Permanent JSON File Backup & Import */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>永久防遺失備份（下載至手機 / 電腦檔案）</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    本系統已啟用 <code>LocalStorage + IndexedDB</code> 雙重本機儲存與分享連結完整快照，不會自動刪除資料；若換新手機或清除瀏覽器紀錄前，也可一鍵下載永久備份檔：
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        exportAllGroupsJson(groups);
                        setRestoreMsg(`✅ 已下載全部 ${groups.length} 個帳本的永久備份檔 (.json)！`);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下載全部帳本備份 (.json)</span>
                    </button>

                    <label className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>匯入備份檔 (.json)</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            try {
                              const imported = parseImportedGroupsJson(
                                String(reader.result || '')
                              );
                              if (imported.length === 0) {
                                setRestoreMsg('⚠️ 備份檔內沒有找到有效的分帳群組資料');
                                return;
                              }
                              if (onImportGroupsBackup) {
                                onImportGroupsBackup(imported);
                              } else {
                                imported.forEach((g) => onRestoreGroupFromUrl(g));
                              }
                              setRestoreMsg(`✅ 成功匯入 ${imported.length} 個分帳群組！`);
                            } catch {
                              setRestoreMsg('⚠️ 無法解析此 JSON 備份檔案');
                            }
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {restoreMsg && (
                  <div className="p-3 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{restoreMsg}</span>
                  </div>
                )}

                <form onSubmit={handleRestoreSubmit} className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5 leading-relaxed">
                    <div className="font-bold">💡 或從 LINE 聊天室分享連結還原帳目：</div>
                    <p>
                      把之前傳給朋友、含有 <code>?group=...&s=...</code> 的分享連結貼在下方並點「立即還原」，裡面打過的所有成員與帳目也會完整加回來！
                    </p>
                  </div>

                  <textarea
                    rows={3}
                    value={restoreUrlInput}
                    onChange={(e) => setRestoreUrlInput(e.target.value)}
                    placeholder="貼上含有 ?group=...&s=... 的分享網址..."
                    className="w-full p-3 rounded-2xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                  >
                    立即從連結還原群組資料
                  </button>
                </form>
              </div>
            )}

            {/* Bottom Actions: Create New Group & Cloud/Exchange Rate Settings */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewGroup();
                }}
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                建立新分帳群組
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCloudSettings();
                }}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Settings className="w-4 h-4" />
                匯率、雲端同步與 LIFF 設定
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
