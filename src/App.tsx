import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Share2,
  Receipt,
  ArrowRightLeft,
  Users,
  Trash2,
  Edit3,
  CheckCircle2,
  Copy,
  Check,
  UserPlus,
  Sparkles,
  RotateCcw,
  Wallet,
  Crown,
  Camera,
} from 'lucide-react';
import {
  BillGroup,
  CurrencyCode,
  Expense,
  Member,
  SettlementRecord,
} from './types/bill';
import {
  AVATAR_COLORS,
  CATEGORY_META,
  fetchLiveRatesToBase,
  formatMoney,
} from './utils/currencies';
import {
  calculateGroupBalances,
  simplifyDebts,
} from './utils/settlement';
import { createDemoGroup, createKaohsiungGroup } from './utils/demoData';
import {
  buildShareableGroupUrl,
  ensureGroupSyncKey,
  fetchGroupFromCloud,
  isCloudSyncEnabled,
  loadLocalGroups,
  parseGroupFromUrl,
  recordDeletedGroupTombstone,
  recoverGroupsFromIndexedDB,
  requestPersistentStorage,
  saveLocalGroups,
  subscribeToCloudGroup,
  syncGroupToCloud,
  syncOwnerVaultWithCloud,
} from './services/cloudSync';
import {
  initLineLiff,
  LineUserProfile,
} from './services/liffService';
import { ExpenseModal } from './components/ExpenseModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ShareCardModal } from './components/ShareCardModal';
import { CloudSettingsModal } from './components/CloudSettingsModal';
import { NewGroupModal } from './components/NewGroupModal';
import { EditGroupModal } from './components/EditGroupModal';
import { OwnerAdminModal } from './components/OwnerAdminModal';

function isUneditedDefaultGroup(g: BillGroup): boolean {
  if (g.updatedAt <= 1000) return true;
  if (
    g.id === 'kaohsiung-trip' &&
    g.name === '高雄之旅' &&
    !g.coverImageUrl &&
    g.coverEmoji === '🏖️' &&
    g.expenses.length === 0 &&
    g.members.length === 3 &&
    g.members[0]?.name === 'Mona' &&
    g.members[1]?.name === '好友 A' &&
    g.members[2]?.name === '好友 B'
  ) {
    return true;
  }
  return false;
}

function getEffectiveTimestamp(g: BillGroup): number {
  return isUneditedDefaultGroup(g) ? 1000 : g.updatedAt || 1000;
}

function deduplicateGroupsKeepingNewest(list: BillGroup[]): BillGroup[] {
  const map = new Map<string, BillGroup>();
  for (const g of list) {
    const existing = map.get(g.id);
    if (
      !existing ||
      getEffectiveTimestamp(g) > getEffectiveTimestamp(existing)
    ) {
      map.set(g.id, g);
    }
  }
  return Array.from(map.values());
}

export const App: React.FC = () => {
  const initialUrlState = useMemo(() => parseGroupFromUrl(), []);

  // Lock to single-group view ONLY when a friend opens an explicit shared link (?mode=shared)
  const isFriendSharedView = useMemo(() => {
    return initialUrlState.isSharedLink;
  }, [initialUrlState]);

  const [groups, setGroups] = useState<BillGroup[]>(() => {
    const { groupId, syncKey, sharedGroup, isSharedLink } = initialUrlState;

    // Case A: Friend opened an explicit shared link (?mode=shared&group=...&k=...&s=...)
    // -> ONLY load that single shared group in state so friends NEVER see any other group
    if (isSharedLink) {
      const saved = deduplicateGroupsKeepingNewest(loadLocalGroups());
      if (sharedGroup) {
        const existing = saved.find((g) => g.id === sharedGroup.id);
        const baseLatest =
          existing && getEffectiveTimestamp(existing) > getEffectiveTimestamp(sharedGroup)
            ? existing
            : sharedGroup;
        const latest: BillGroup = {
          ...baseLatest,
          syncKey: baseLatest.syncKey || sharedGroup.syncKey || syncKey || undefined,
        };
        const merged = existing
          ? saved.map((g) => (g.id === sharedGroup.id ? latest : g))
          : [latest, ...saved];
        saveLocalGroups(merged);
        return [latest];
      }

      if (groupId) {
        const found = saved.find((g) => g.id === groupId);
        if (found) {
          return [{ ...found, syncKey: found.syncKey || syncKey || undefined }];
        }
        const placeholder = createKaohsiungGroup();
        return [
          {
            ...placeholder,
            id: groupId,
            syncKey: syncKey || undefined,
            updatedAt: 1000,
          },
        ];
      }

      const kh =
        saved.find((g) => g.id === 'kaohsiung-trip' || g.name.includes('高雄')) ||
        createKaohsiungGroup();
      return [{ ...kh, syncKey: kh.syncKey || syncKey || undefined }];
    }

    // Case B: Owner mode
    // Clean up any legacy ?group=...&s=... URL parameters without mode=shared
    if (!isSharedLink && window.location.search) {
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // ignore
      }
    }

    let saved = deduplicateGroupsKeepingNewest(loadLocalGroups()).map((g) =>
      ensureGroupSyncKey(g)
    );

    // If a legacy URL had a non-demo group snapshot, merge it into saved groups first
    if (!isSharedLink && sharedGroup && sharedGroup.id !== 'tokyo-trip-demo') {
      const exists = saved.some((g) => g.id === sharedGroup.id);
      saved = exists
        ? saved.map((g) =>
            g.id === sharedGroup.id &&
            getEffectiveTimestamp(sharedGroup) >= getEffectiveTimestamp(g)
              ? sharedGroup
              : g
          )
        : [sharedGroup, ...saved];
    }

    if (saved.length === 0) {
      const kh = createKaohsiungGroup();
      const demo = createDemoGroup();
      const initial = [kh, demo];
      saveLocalGroups(initial);
      return initial;
    }

    const hasCustomOrKaohsiung = saved.some(
      (g) =>
        g.id === 'kaohsiung-trip' ||
        g.name.includes('高雄') ||
        g.id !== 'tokyo-trip-demo'
    );
    const khDeleted = localStorage.getItem('splitmates_kh_deleted') === 'true';
    if (!hasCustomOrKaohsiung && !khDeleted) {
      const kh = createKaohsiungGroup();
      const restored = [kh, ...saved];
      saveLocalGroups(restored);
      return restored;
    }

    saveLocalGroups(saved);
    return saved;
  });

  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    if (initialUrlState.isSharedLink && initialUrlState.sharedGroup) {
      return initialUrlState.sharedGroup.id;
    }
    if (initialUrlState.isSharedLink && initialUrlState.groupId) {
      return initialUrlState.groupId;
    }
    const saved = deduplicateGroupsKeepingNewest(loadLocalGroups());
    // Prefer the most recently edited non-demo active group
    const editedCustom = saved
      .filter(
        (g) =>
          g.id !== 'tokyo-trip-demo' &&
          !g.isArchived &&
          !isUneditedDefaultGroup(g)
      )
      .sort((a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a));
    if (editedCustom.length > 0) {
      return editedCustom[0].id;
    }
    const kh = saved.find(
      (g) =>
        (g.id === 'kaohsiung-trip' || g.name.includes('高雄')) && !g.isArchived
    );
    if (kh) return kh.id;
    const customActive = saved.find(
      (g) => g.id !== 'tokyo-trip-demo' && !g.isArchived
    );
    if (customActive) return customActive.id;
    const anyActive = saved.find((g) => !g.isArchived);
    if (anyActive) return anyActive.id;
    return saved[0]?.id || 'kaohsiung-trip';
  });

  const [activeTab, setActiveTab] = useState<'expenses' | 'settlement' | 'members'>(
    'expenses'
  );
  const [filterMemberId, setFilterMemberId] = useState<string>('all');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [isOwnerAdminModalOpen, setIsOwnerAdminModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'member' | 'expense' | 'group';
    id: string;
    name: string;
    detail?: string;
  } | null>(null);

  // Live Exchange Rates & Cloud / LIFF Status
  const [liveRates, setLiveRates] = useState<Partial<Record<CurrencyCode, number>>>({});
  const [cloudActive, setCloudActive] = useState<boolean>(() => isCloudSyncEnabled());
  const [lineProfile, setLineProfile] = useState<LineUserProfile | null>(null);

  // Member management inputs
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPayment, setNewMemberPayment] = useState('');
  const [copiedAccountIdx, setCopiedAccountIdx] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const activeGroup = useMemo(() => {
    return groups.find((g) => g.id === activeGroupId) || groups[0];
  }, [groups, activeGroupId]);

  const showNotice = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 3500);
  };

  // Cross-browser Owner Vault Sync (bridges iOS Home Screen App ↔ Safari ↔ Desktop)
  const runOwnerVaultSync = async (
    baseGroups?: BillGroup[],
    baseActiveId?: string,
    preferLocalActive = false
  ) => {
    if (isFriendSharedView) return;
    const currentList =
      baseGroups ||
      (loadLocalGroups().length > 0 ? loadLocalGroups() : groups);
    const currentActive = baseActiveId || activeGroupId;
    const vaultRes = await syncOwnerVaultWithCloud(
      currentList,
      currentActive,
      preferLocalActive
    );
    if (vaultRes && vaultRes.groups.length > 0) {
      saveLocalGroups(vaultRes.groups);
      setGroups(vaultRes.groups);
      if (vaultRes.activeGroupId && vaultRes.activeGroupId !== currentActive) {
        setActiveGroupId(vaultRes.activeGroupId);
      }
      // Ensure each edited group is also written to its individual permanent cloud key for friend share links
      vaultRes.groups.forEach((g) => {
        if (!isUneditedDefaultGroup(g) && g.id !== 'tokyo-trip-demo') {
          void syncGroupToCloud(g);
        }
      });
    }
  };

  // 1. Initialize LINE LIFF + Anti-Eviction Persistent Storage + IndexedDB Auto-Recovery
  useEffect(() => {
    initLineLiff().then(({ profile }) => {
      if (profile) setLineProfile(profile);
    });

    // Request persistent browser storage so iOS/mobile browsers won't auto-evict inactive storage
    void requestPersistentStorage();

    // Recover any groups from IndexedDB if LocalStorage was ever cleared by in-app browser cache
    recoverGroupsFromIndexedDB().then((idbGroups) => {
      const currentLocal = loadLocalGroups();
      if (!idbGroups || idbGroups.length === 0) {
        if (currentLocal.length > 0) {
          saveLocalGroups(currentLocal);
        }
        return;
      }

      const merged = deduplicateGroupsKeepingNewest([
        ...currentLocal,
        ...idbGroups,
      ]).map((g) => ensureGroupSyncKey(g));

      // Check if IndexedDB recovered any edited group that was missing or older in LocalStorage
      const recoveredNewer = idbGroups.some((ig) => {
        if (isUneditedDefaultGroup(ig)) return false;
        const loc = currentLocal.find((lg) => lg.id === ig.id);
        return !loc || getEffectiveTimestamp(ig) > getEffectiveTimestamp(loc);
      });

      if (recoveredNewer) {
        saveLocalGroups(merged);
        if (!isFriendSharedView) {
          setGroups(merged);
        } else if (initialUrlState.groupId) {
          const match = merged.find((g) => g.id === initialUrlState.groupId);
          if (match) setGroups([match]);
        }
      }
    });
  }, [isFriendSharedView, initialUrlState.groupId]);

  // 2. Real-Time Cloud Sync (Initial Pull/Push + SSE Live Stream + Polling)
  useEffect(() => {
    if (!cloudActive || !activeGroup) return;

    const applyRemoteIfNewer = (remoteGroup: BillGroup) => {
      setGroups((prev) => {
        const current = prev.find((g) => g.id === remoteGroup.id);
        if (
          current &&
          getEffectiveTimestamp(remoteGroup) <= getEffectiveTimestamp(current)
        ) {
          return prev;
        }
        const mergedRemote: BillGroup = {
          ...remoteGroup,
          coverImageUrl: remoteGroup.coverImageUrl || current?.coverImageUrl,
        };
        const exists = prev.some((g) => g.id === mergedRemote.id);
        const next = exists
          ? prev.map((g) => (g.id === mergedRemote.id ? mergedRemote : g))
          : [mergedRemote, ...prev];

        const allSaved = loadLocalGroups();
        const savedExists = allSaved.some((g) => g.id === mergedRemote.id);
        const nextSaved = savedExists
          ? allSaved.map((g) => (g.id === mergedRemote.id ? mergedRemote : g))
          : [mergedRemote, ...allSaved];
        saveLocalGroups(nextSaved);

        return isFriendSharedView ? [mergedRemote] : next;
      });
    };

    const checkAndSyncNow = () => {
      fetchGroupFromCloud(activeGroup.id, activeGroup.syncKey).then((cloudGrp) => {
        const localLatest =
          loadLocalGroups().find((g) => g.id === activeGroup.id) || activeGroup;
        if (
          cloudGrp &&
          getEffectiveTimestamp(cloudGrp) > getEffectiveTimestamp(localLatest)
        ) {
          applyRemoteIfNewer(cloudGrp);
        } else if (
          !isUneditedDefaultGroup(localLatest) &&
          (!cloudGrp ||
            getEffectiveTimestamp(localLatest) > getEffectiveTimestamp(cloudGrp))
        ) {
          void syncGroupToCloud(localLatest);
        }
      });

      if (!isFriendSharedView) {
        void runOwnerVaultSync();
      }
    };

    // Initial check on mount or active group switch
    checkAndSyncNow();

    // Immediately re-sync whenever switching between iOS Home Screen App, Safari, or LINE
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        checkAndSyncNow();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const unsub = subscribeToCloudGroup(
      activeGroup.id,
      activeGroup.syncKey,
      (remoteGroup) => {
        applyRemoteIfNewer(remoteGroup);
      }
    );

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (unsub) unsub();
    };
  }, [cloudActive, activeGroup?.id, activeGroup?.syncKey, isFriendSharedView]);

  // 3. Fetch live exchange rates for activeGroup.baseCurrency
  const refreshRates = async () => {
    if (!activeGroup) return;
    const rates = await fetchLiveRatesToBase(activeGroup.baseCurrency);
    setLiveRates(rates);
  };

  useEffect(() => {
    refreshRates();
  }, [activeGroup?.baseCurrency]);

  // Helper to update active group locally + sync to cloud
  const updateActiveGroup = (updater: (grp: BillGroup) => BillGroup) => {
    setGroups((prev) => {
      let updatedTarget: BillGroup | null = null;
      const next = prev.map((g) => {
        if (g.id !== activeGroup.id) return g;
        const updated = { ...updater(g), updatedAt: Date.now() };
        updatedTarget = updated;
        if (isCloudSyncEnabled()) {
          syncGroupToCloud(updated);
        }
        return updated;
      });

      const allSaved = loadLocalGroups();
      let finalSavedList = next;
      if (updatedTarget) {
        const target = updatedTarget as BillGroup;
        const exists = allSaved.some((g) => g.id === target.id);
        finalSavedList = exists
          ? allSaved.map((g) => (g.id === target.id ? target : g))
          : [target, ...allSaved];
        saveLocalGroups(finalSavedList);
      } else {
        saveLocalGroups(next);
      }

      if (!isFriendSharedView) {
        void syncOwnerVaultWithCloud(finalSavedList, activeGroup.id, true);
      }

      if (isFriendSharedView && updatedTarget) {
        try {
          const newUrl = buildShareableGroupUrl(updatedTarget);
          window.history.replaceState(null, '', newUrl);
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // When owner opens the Admin Modal, ensure all saved local groups are loaded into state
  const handleOpenOwnerAdmin = () => {
    const allSaved = loadLocalGroups();
    if (allSaved.length > groups.length) {
      setGroups(allSaved);
    }
    setIsOwnerAdminModalOpen(true);
  };

  // Archive / Unarchive a group
  const handleToggleArchiveGroup = (groupId: string) => {
    const allSaved = loadLocalGroups();
    const sourceList = allSaved.length >= groups.length ? allSaved : groups;
    const target = sourceList.find((g) => g.id === groupId);
    if (!target) return;
    const nextArchivedState = !target.isArchived;

    const updatedGroups = sourceList.map((g) =>
      g.id === groupId
        ? { ...g, isArchived: nextArchivedState, updatedAt: Date.now() }
        : g
    );
    setGroups(updatedGroups);
    saveLocalGroups(updatedGroups);
    void syncOwnerVaultWithCloud(updatedGroups, groupId, true);

    if (nextArchivedState) {
      const remainingActive = updatedGroups.filter((g) => !g.isArchived);
      if (remainingActive.length > 0 && activeGroup.id === groupId) {
        setActiveGroupId(remainingActive[0].id);
      }
      showNotice(`📦 已將「${target.name}」移至歷史封存區！`);
    } else {
      setActiveGroupId(groupId);
      showNotice(`📂 已將「${target.name}」還原回進行中！`);
    }
  };

  // Permanently delete a group
  const handleDeleteGroup = (groupId: string) => {
    const allSaved = loadLocalGroups();
    const sourceList = allSaved.length >= groups.length ? allSaved : groups;
    const target = sourceList.find((g) => g.id === groupId);
    if (!target) return;
    recordDeletedGroupTombstone(groupId);
    if (target.name.includes('高雄')) {
      try {
        localStorage.setItem('splitmates_kh_deleted', 'true');
      } catch {
        // ignore
      }
    }
    const remaining = sourceList.filter((g) => g.id !== groupId);

    if (remaining.length === 0) {
      const fresh = createKaohsiungGroup();
      setGroups([fresh]);
      saveLocalGroups([fresh]);
      setActiveGroupId(fresh.id);
      setIsNewGroupModalOpen(true);
      showNotice(`🗑️ 已刪除「${target.name}」，請建立新的分帳群組！`);
      return;
    }

    setGroups(remaining);
    saveLocalGroups(remaining);
    const nextActive = remaining.find((g) => !g.isArchived) || remaining[0];
    setActiveGroupId(nextActive.id);
    void syncOwnerVaultWithCloud(remaining, nextActive.id, true);
    showNotice(`🗑️ 已永久刪除群組「${target.name}」`);
  };

  const balances = useMemo(() => calculateGroupBalances(activeGroup), [activeGroup]);
  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const shareUrl = useMemo(() => buildShareableGroupUrl(activeGroup), [activeGroup]);

  const totalSpendBase = useMemo(
    () => activeGroup.expenses.reduce((sum, e) => sum + e.baseAmount, 0),
    [activeGroup.expenses]
  );

  const filteredExpenses = useMemo(() => {
    if (filterMemberId === 'all') return activeGroup.expenses;
    return activeGroup.expenses.filter(
      (e) =>
        e.paidBy.some((p) => p.memberId === filterMemberId && p.amount > 0) ||
        e.splits.some((s) => s.memberId === filterMemberId && s.calculatedAmount > 0)
    );
  }, [activeGroup.expenses, filterMemberId]);

  // Handlers for Expenses
  const handleSaveExpense = (
    expenseData: Omit<Expense, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    updateActiveGroup((grp) => {
      if (existingId) {
        return {
          ...grp,
          expenses: grp.expenses.map((e) =>
            e.id === existingId ? { ...e, ...expenseData } : e
          ),
        };
      }
      const newExp: Expense = {
        ...expenseData,
        id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        createdAt: Date.now(),
      };
      return {
        ...grp,
        expenses: [newExp, ...grp.expenses],
      };
    });
    showNotice(existingId ? '✅ 已更新分帳項目！' : '✅ 已新增一筆分帳！');
  };

  const handleSaveBatchExpenses = (
    expensesToCreate: Array<Omit<Expense, 'id' | 'createdAt'>>
  ) => {
    if (expensesToCreate.length === 0) return;
    const now = Date.now();
    updateActiveGroup((grp) => {
      const created: Expense[] = expensesToCreate.map((expData, idx) => ({
        ...expData,
        id: `exp-${(now + idx).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 5)}`,
        createdAt: now + idx,
      }));
      return {
        ...grp,
        expenses: [...created, ...grp.expenses],
      };
    });
    setActiveTab('expenses');
    showNotice(
      expensesToCreate.length === 1
        ? '📷 已將收據掃描分帳寫入帳本！'
        : `📷 已將收據拆成 ${expensesToCreate.length} 筆分帳寫入帳本！`
    );
  };

  const handleDeleteExpense = (expenseId: string) => {
    const exp = activeGroup.expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    setPendingDelete({
      type: 'expense',
      id: expenseId,
      name: exp.title,
      detail: `金額：${formatMoney(
        Math.round(exp.baseAmount),
        activeGroup.baseCurrency
      )}（刪除後將自動重新計算分帳結算）`,
    });
  };

  // Handlers for Settlements
  const handleMarkSettled = (fromId: string, toId: string, amount: number) => {
    const newRec: SettlementRecord = {
      id: `settle-${Date.now().toString(36)}`,
      fromMemberId: fromId,
      toMemberId: toId,
      amount,
      settledAt: Date.now(),
    };
    updateActiveGroup((grp) => ({
      ...grp,
      settledRecords: [newRec, ...(grp.settledRecords || [])],
    }));
    const fromName = activeGroup.members.find((m) => m.id === fromId)?.name || '';
    const toName = activeGroup.members.find((m) => m.id === toId)?.name || '';
    showNotice(
      `🎉 已將「${fromName} ➜ ${toName} (${formatMoney(
        amount,
        activeGroup.baseCurrency
      )})」標記為已結清！`
    );
  };

  const handleUndoSettlement = (recordId: string) => {
    updateActiveGroup((grp) => ({
      ...grp,
      settledRecords: (grp.settledRecords || []).filter((r) => r.id !== recordId),
    }));
    showNotice('↩️ 已取消該筆結清紀錄');
  };

  // Handlers for Members
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMemberName.trim();
    if (!clean) return;
    const newMem: Member = {
      id: `m-${Date.now().toString(36)}`,
      name: clean,
      avatarColor:
        AVATAR_COLORS[activeGroup.members.length % AVATAR_COLORS.length],
      paymentInfo: newMemberPayment.trim() || undefined,
    };
    updateActiveGroup((grp) => ({
      ...grp,
      members: [...grp.members, newMem],
    }));
    setNewMemberName('');
    setNewMemberPayment('');
    showNotice(`👋 已新增成員「${clean}」！`);
  };

  const handleUpdateMemberName = (memberId: string, name: string) => {
    updateActiveGroup((grp) => ({
      ...grp,
      members: grp.members.map((m) =>
        m.id === memberId ? { ...m, name } : m
      ),
    }));
  };

  const handleUpdateMemberPayment = (memberId: string, paymentInfo: string) => {
    updateActiveGroup((grp) => ({
      ...grp,
      members: grp.members.map((m) =>
        m.id === memberId ? { ...m, paymentInfo } : m
      ),
    }));
  };

  const handleRemoveMember = (memberId: string) => {
    if (activeGroup.members.length <= 1) {
      showNotice('⚠️ 群組至少需保留 1 位成員');
      return;
    }
    const target = activeGroup.members.find((m) => m.id === memberId);
    if (!target) return;
    setPendingDelete({
      type: 'member',
      id: memberId,
      name: target.name || '未命名成員',
      detail: '確定要將此成員從群組名單中移除嗎？',
    });
  };

  const handleRequestDeleteGroup = (groupId: string) => {
    const allSaved = loadLocalGroups();
    const sourceList = allSaved.length >= groups.length ? allSaved : groups;
    const target = sourceList.find((g) => g.id === groupId);
    if (!target) return;
    setPendingDelete({
      type: 'group',
      id: groupId,
      name: target.name,
      detail: `包含 ${target.members.length} 位成員、${target.expenses.length} 筆消費紀錄（永久刪除後無法復原）`,
    });
  };

  const executeConfirmedDelete = () => {
    if (!pendingDelete) return;
    const { type, id, name } = pendingDelete;
    setPendingDelete(null);

    if (type === 'expense') {
      updateActiveGroup((grp) => ({
        ...grp,
        expenses: grp.expenses.filter((e) => e.id !== id),
      }));
      showNotice(`🗑️ 已刪除消費「${name}」`);
      return;
    }

    if (type === 'member') {
      const hasExpenseRef = activeGroup.expenses.some(
        (e) =>
          e.paidBy.some((p) => p.memberId === id && p.amount > 0) ||
          e.splits.some((s) => s.memberId === id && s.calculatedAmount > 0)
      );
      if (hasExpenseRef) {
        showNotice(
          `⚠️ 「${name}」已有參與帳目分攤，請先移除相關帳目或直接修改名字！`
        );
        return;
      }
      updateActiveGroup((grp) => ({
        ...grp,
        members: grp.members.filter((m) => m.id !== id),
      }));
      showNotice(`🗑️ 已移除成員「${name}」`);
      return;
    }

    if (type === 'group') {
      handleDeleteGroup(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      {/* Top App Bar: Ultra-clean! Only current group avatar + name on left; Share + private Owner Admin button on right */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Left: Current Group Avatar & Title (No blue text, no arrows, no other group icons!) */}
          <div className="flex items-center gap-2.5 min-w-0">
            {activeGroup.coverImageUrl ? (
              <img
                src={activeGroup.coverImageUrl}
                alt={activeGroup.name}
                className="w-9 h-9 rounded-2xl object-cover border border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-lg shadow-md shrink-0">
                {activeGroup.coverEmoji}
              </div>
            )}

            <span className="font-bold text-base sm:text-lg truncate">
              {activeGroup.name}
            </span>
          </div>

          {/* Right: Share button + Private Owner-only Admin button (Hidden from friends opening shared link!) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>LINE / IG 分享</span>
            </button>

            {!isFriendSharedView && (
              <button
                type="button"
                onClick={handleOpenOwnerAdmin}
                title="管理員專屬：我的所有群組 / 封存 / 編輯與設定"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 border border-slate-700 transition"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>我的帳本</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {bannerNotice && (
        <div className="max-w-3xl mx-auto px-4 mt-3">
          <div className="px-4 py-2.5 rounded-2xl bg-indigo-950 text-white text-xs font-semibold shadow-lg flex items-center justify-between">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-indigo-300 hover:text-white ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container (Strictly ONLY the current group!) */}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Hero Overview Card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-indigo-200 text-xs font-medium">
                  <span>基準結算幣別：{activeGroup.baseCurrency}</span>
                  <span>·</span>
                  <span>{activeGroup.members.length} 位好友共同分帳</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ensured = ensureGroupSyncKey(activeGroup);
                    const cloudGrp = await fetchGroupFromCloud(
                      ensured.id,
                      ensured.syncKey
                    );
                    if (
                      cloudGrp &&
                      getEffectiveTimestamp(cloudGrp) >
                        getEffectiveTimestamp(ensured)
                    ) {
                      const nextList = groups.map((g) =>
                        g.id === cloudGrp.id ? cloudGrp : g
                      );
                      setGroups(nextList);
                      saveLocalGroups(nextList);
                    } else if (!isUneditedDefaultGroup(ensured)) {
                      await syncGroupToCloud({
                        ...ensured,
                        updatedAt: ensured.updatedAt || Date.now(),
                      });
                    }
                    await runOwnerVaultSync();
                    showNotice('☁️ 已完成跨瀏覽器與分享連結永久雲端同步！');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>雲端即時同步</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pt-0.5">
                {activeGroup.coverImageUrl ? (
                  <img
                    src={activeGroup.coverImageUrl}
                    alt={activeGroup.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-white/25 shadow-md"
                  />
                ) : (
                  <span className="text-3xl">{activeGroup.coverEmoji}</span>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {activeGroup.name}
                  </h1>
                  {activeGroup.description && (
                    <p className="text-xs text-slate-300 mt-0.5">
                      {activeGroup.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:text-right bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
              <div className="text-xs text-indigo-200">群組累計總花費</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-sky-300 mt-0.5">
                {formatMoney(Math.round(totalSpendBase), activeGroup.baseCurrency)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                平均每人約{' '}
                {formatMoney(
                  Math.round(
                    totalSpendBase / Math.max(1, activeGroup.members.length)
                  ),
                  activeGroup.baseCurrency
                )}{' '}
                · 共 {activeGroup.expenses.length} 筆
              </div>
            </div>
          </div>

          {/* Quick Action Strip inside Hero */}
          <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {activeGroup.members.map((m) => (
                <div
                  key={m.id}
                  title={m.name}
                  className={`w-7 h-7 rounded-full ${m.avatarColor} ring-2 ring-slate-900 text-white text-xs font-bold flex items-center justify-center`}
                >
                  {m.name.slice(0, 1)}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className="ml-3 pl-2 text-xs text-indigo-200 hover:text-white font-medium underline"
              >
                成員與收款帳號 ({activeGroup.members.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                產生結算圖片小卡
              </button>
              <button
                type="button"
                onClick={() => setIsReceiptScannerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-fuchsia-500/25 hover:bg-fuchsia-500/35 border border-fuchsia-300/30 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-fuchsia-200" />
                拍收據分帳
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingExpense(null);
                  setIsExpenseModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                記一筆花費
              </button>
            </div>
          </div>
        </section>

        {/* Primary 3-Tab Switcher */}
        <nav className="grid grid-cols-3 gap-1.5 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'expenses'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>帳目明細 ({activeGroup.expenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'settlement'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>最少轉帳結算 ({transfers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'members'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>成員與收款 ({activeGroup.members.length})</span>
          </button>
        </nav>

        {/* TAB 1: EXPENSES LIST */}
        {activeTab === 'expenses' && (
          <section className="space-y-3">
            {/* Member Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setFilterMemberId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition ${
                  filterMemberId === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                全部帳目 ({activeGroup.expenses.length})
              </button>
              {activeGroup.members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilterMemberId(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition ${
                    filterMemberId === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full ${m.avatarColor} text-white text-[10px] flex items-center justify-center`}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                  <span>{m.name}</span>
                </button>
              ))}
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3">
                <div className="text-4xl">🧾</div>
                <h3 className="text-base font-bold text-slate-800">目前還沒有分帳紀錄</h3>
                <p className="text-xs text-slate-500">
                  點選下方按鈕新增第一筆消費，可自由勾選誰要參與平分（先付錢的人也可以不參與分攤）！
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReceiptScannerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-violet-100 hover:bg-violet-200 text-violet-800 text-xs font-bold transition"
                  >
                    <Camera className="w-4 h-4" />
                    拍收據自動偵測品項
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpense(null);
                      setIsExpenseModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-bold shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    新增第一筆帳目
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredExpenses.map((exp) => {
                  const cat = CATEGORY_META[exp.category] || CATEGORY_META.other;
                  const payerNames = exp.paidBy
                    .map((p) => {
                      const mem = activeGroup.members.find(
                        (m) => m.id === p.memberId
                      );
                      return mem
                        ? exp.paidBy.length > 1
                          ? `${mem.name} (${formatMoney(p.amount, exp.currency)})`
                          : mem.name
                        : '未知';
                    })
                    .join(' + ');

                  const activeSplits = exp.splits.filter((s) => s.calculatedAmount > 0);
                  const modeLabel =
                    exp.splitMode === 'equal'
                      ? `${activeSplits.length}人平分`
                      : exp.splitMode === 'shares'
                      ? '比例/份數'
                      : exp.splitMode === 'exact'
                      ? '自訂金額'
                      : '百分比';

                  return (
                    <div
                      key={exp.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:border-indigo-200 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${cat.badgeClass}`}
                          >
                            {cat.emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                {exp.title}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                {modeLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>📅 {exp.date}</span>
                              <span>·</span>
                              <span className="text-indigo-700 font-semibold">
                                💳 {payerNames} 先墊付
                              </span>
                            </div>
                            {exp.note && (
                              <p className="text-xs text-slate-500 mt-1 bg-slate-50 px-2.5 py-1 rounded-lg">
                                💬 {exp.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base sm:text-lg font-extrabold text-slate-900">
                            {formatMoney(
                              Math.round(exp.baseAmount),
                              activeGroup.baseCurrency
                            )}
                          </div>
                          {exp.currency !== activeGroup.baseCurrency && (
                            <div className="text-xs font-semibold text-indigo-600">
                              原幣 {formatMoney(exp.originalAmount, exp.currency)} (匯率{' '}
                              {exp.exchangeRateToBase})
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpense(exp);
                                setIsExpenseModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="編輯此筆帳目"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="刪除此筆帳目"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Per-member split chips */}
                      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {activeSplits.map((s) => {
                          const mem = activeGroup.members.find(
                            (m) => m.id === s.memberId
                          );
                          if (!mem) return null;
                          const baseShare =
                            s.calculatedAmount * (exp.exchangeRateToBase || 1);
                          return (
                            <span
                              key={s.memberId}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700"
                            >
                              <span className="font-semibold">{mem.name}</span>
                              <span className="text-slate-400">應攤</span>
                              <span className="font-bold text-slate-900">
                                {formatMoney(
                                  Math.round(baseShare),
                                  activeGroup.baseCurrency
                                )}
                              </span>
                              {exp.splitMode === 'shares' && (
                                <span className="text-indigo-600">({s.value}份)</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: SETTLEMENT & SIMPLIFIED TRANSFERS */}
        {activeTab === 'settlement' && (
          <section className="space-y-4">
            {/* Minimum Transfers Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>⚡ 最少轉帳次數結算建議</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
                      只需轉帳 {transfers.length} 筆
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    系統已自動抵銷多方交叉墊付，算出最省事的還款路徑：
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  一鍵轉發結算單到 LINE / IG
                </button>
              </div>

              {transfers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <div className="text-2xl">🎉</div>
                  <div className="text-sm font-bold text-emerald-900">
                    太棒了！目前所有帳目皆已結清，大家互不相欠！
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {transfers.map((t, idx) => {
                    const receiver = activeGroup.members.find(
                      (m) => m.id === t.toMemberId
                    );
                    const copyKey = `${t.fromMemberId}-${t.toMemberId}`;

                    return (
                      <div
                        key={copyKey}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {t.fromMemberName}
                            </span>
                            <span className="text-xs font-bold text-indigo-600 px-2 py-0.5 rounded-md bg-indigo-50">
                              ➜ 應轉給 ➜
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {t.toMemberName}
                            </span>
                            <span className="text-base font-extrabold text-rose-600 ml-1">
                              {formatMoney(t.amount, activeGroup.baseCurrency)}
                            </span>
                          </div>

                          {receiver?.paymentInfo && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 pl-7">
                              <span>🏦 {receiver.name} 收款方式：{receiver.paymentInfo}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(receiver.paymentInfo || '');
                                  setCopiedAccountIdx(copyKey);
                                  setTimeout(() => setCopiedAccountIdx(null), 2000);
                                }}
                                className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                              >
                                {copiedAccountIdx === copyKey ? (
                                  <>
                                    <Check className="w-3 h-3" /> 已複製
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> 複製帳號
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleMarkSettled(t.fromMemberId, t.toMemberId, t.amount)
                          }
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-sm transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          標記已結清
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Individual Net Balances */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                📊 每位成員消費與先墊統計（基準幣：{activeGroup.baseCurrency}）
              </h3>
              <div className="divide-y divide-slate-100">
                {balances.map((b) => {
                  const mem = activeGroup.members.find((m) => m.id === b.memberId);
                  return (
                    <div
                      key={b.memberId}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full ${
                            mem?.avatarColor || 'bg-indigo-500'
                          } text-white text-xs font-bold flex items-center justify-center`}
                        >
                          {b.memberName.slice(0, 1)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {b.memberName}
                          </div>
                          <div className="text-xs text-slate-500">
                            個人應分攤{' '}
                            {formatMoney(
                              Math.round(b.totalOwed),
                              activeGroup.baseCurrency
                            )}{' '}
                            ｜ 累計先墊{' '}
                            {formatMoney(
                              Math.round(b.totalPaid),
                              activeGroup.baseCurrency
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {b.netBalance > 0 ? (
                          <span className="inline-block px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs border border-emerald-200">
                            應收回 +{formatMoney(Math.round(b.netBalance), activeGroup.baseCurrency)}
                          </span>
                        ) : b.netBalance < 0 ? (
                          <span className="inline-block px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-extrabold text-xs border border-rose-200">
                            應付出 -{formatMoney(Math.round(Math.abs(b.netBalance)), activeGroup.baseCurrency)}
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs">
                            已結清 $0
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settled History */}
            {activeGroup.settledRecords && activeGroup.settledRecords.length > 0 && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  ✅ 已結清還款紀錄 ({activeGroup.settledRecords.length})
                </h3>
                <div className="space-y-2">
                  {activeGroup.settledRecords.map((rec) => {
                    const fromName =
                      activeGroup.members.find((m) => m.id === rec.fromMemberId)
                        ?.name || '成員';
                    const toName =
                      activeGroup.members.find((m) => m.id === rec.toMemberId)?.name ||
                      '成員';
                    return (
                      <div
                        key={rec.id}
                        className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800">
                            {fromName} 已還給 {toName}
                          </span>
                          <span className="ml-2 font-extrabold text-emerald-700">
                            {formatMoney(rec.amount, activeGroup.baseCurrency)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUndoSettlement(rec.id)}
                          className="text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          復原
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: MEMBERS & PAYMENT INFO */}
        {activeTab === 'members' && (
          <section className="space-y-4">
            {/* Add New Member Card */}
            <form
              onSubmit={handleAddMember}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  新增分帳好友
                </h2>
                {lineProfile && (
                  <button
                    type="button"
                    onClick={() => setNewMemberName(lineProfile.displayName)}
                    className="text-xs font-bold text-[#06C755] hover:underline"
                  >
                    帶入我的 LINE 暱稱 ({lineProfile.displayName})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="好友暱稱（例如：小美）"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input
                  type="text"
                  value={newMemberPayment}
                  onChange={(e) => setNewMemberPayment(e.target.value)}
                  placeholder="收款資訊（選填：LINE Pay / 銀行帳號）"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  加入群組
                </button>
              </div>
            </form>

            {/* Member List & Name / Payment Info Editor */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  群組成員名單與收款帳號編輯
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                可直接點擊下方輸入框<strong>修改好友名字</strong>（例如將「好友 A」改為真實姓名，所有已記帳目會自動同步更新名稱），或填寫 <strong>LINE Pay / 街口 / 銀行帳號</strong>：
              </p>

              <div className="space-y-3 pt-1">
                {activeGroup.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 sm:w-48 shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full ${m.avatarColor} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                      >
                        {(m.name || '?').slice(0, 1)}
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) =>
                            handleUpdateMemberName(m.id, e.target.value)
                          }
                          placeholder="輸入好友名字"
                          className="w-full pl-2.5 pr-6 py-1.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <Edit3 className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={m.paymentInfo || ''}
                        onChange={(e) =>
                          handleUpdateMemberPayment(m.id, e.target.value)
                        }
                        placeholder="填寫收款資訊（例：LINE Pay / 台新 812-...）"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {activeGroup.members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          title="刪除此成員"
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Action Bar for Mobile (LINE & IG In-App Browser Friendly) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200 px-3 sm:px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="flex-1 py-3 px-2.5 sm:px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition"
          >
            <Share2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">傳送結算單</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReceiptScannerOpen(true)}
            className="py-3 px-3.5 sm:px-4 rounded-2xl bg-violet-100 hover:bg-violet-200 text-violet-900 border border-violet-200 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition shrink-0"
            title="拍收據或菜單自動偵測品項與價錢分帳"
          >
            <Camera className="w-4 h-4 text-violet-700 shrink-0" />
            <span>拍收據</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsExpenseModalOpen(true);
            }}
            className="flex-[1.15] py-3 px-3 sm:px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/25 transition"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">記一筆花費</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        group={activeGroup}
        editingExpense={editingExpense}
        liveRates={liveRates}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        onSwitchToReceiptScanner={() => {
          setIsExpenseModalOpen(false);
          setIsReceiptScannerOpen(true);
        }}
      />

      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        group={activeGroup}
        liveRates={liveRates}
        onClose={() => setIsReceiptScannerOpen(false)}
        onSaveExpenses={handleSaveBatchExpenses}
      />

      <ShareCardModal
        isOpen={isShareModalOpen}
        group={activeGroup}
        balances={balances}
        transfers={transfers}
        shareUrl={shareUrl}
        onClose={() => setIsShareModalOpen(false)}
      />

      <CloudSettingsModal
        isOpen={isSettingsModalOpen}
        group={activeGroup}
        liveRates={liveRates}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdateGroup={(updated) => updateActiveGroup(() => updated)}
        onRefreshLiveRates={refreshRates}
        onCloudConfigChanged={() => setCloudActive(isCloudSyncEnabled())}
      />

      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onCreate={(newGrp) => {
          const allSaved = loadLocalGroups();
          const next = [newGrp, ...allSaved];
          saveLocalGroups(next);
          setGroups(next);
          setActiveGroupId(newGrp.id);
          if (isCloudSyncEnabled()) {
            void syncGroupToCloud(newGrp);
            void syncOwnerVaultWithCloud(next, newGrp.id, true);
          }
          showNotice(`🎉 已建立新分帳群組「${newGrp.name}」！`);
        }}
      />

      <EditGroupModal
        isOpen={isEditGroupModalOpen}
        group={activeGroup}
        onClose={() => setIsEditGroupModalOpen(false)}
        onSave={(updated) => {
          updateActiveGroup(() => updated);
          showNotice(`✅ 已更新群組「${updated.name}」的資訊與圖示！`);
        }}
        onToggleArchive={handleToggleArchiveGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <OwnerAdminModal
        isOpen={isOwnerAdminModalOpen}
        groups={groups}
        activeGroup={activeGroup}
        onClose={() => setIsOwnerAdminModalOpen(false)}
        onSelectGroup={(gid) => {
          setActiveGroupId(gid);
          setFilterMemberId('all');
          void syncOwnerVaultWithCloud(groups, gid, true);
        }}
        onOwnerPasscodeSynced={() => {
          void runOwnerVaultSync();
          showNotice('🔐 已連結跨瀏覽器管理員雲端保險箱，正在同步所有帳本...');
        }}
        onOpenNewGroup={() => setIsNewGroupModalOpen(true)}
        onOpenEditGroup={() => setIsEditGroupModalOpen(true)}
        onToggleArchiveGroup={handleToggleArchiveGroup}
        onDeleteGroup={handleRequestDeleteGroup}
        onOpenCloudSettings={() => setIsSettingsModalOpen(true)}
        onRestoreGroupFromUrl={(restored) => {
          const ensured = ensureGroupSyncKey(restored);
          const allSaved = loadLocalGroups();
          const exists = allSaved.some((g) => g.id === ensured.id);
          const next = exists
            ? allSaved.map((g) => (g.id === ensured.id ? ensured : g))
            : [ensured, ...allSaved];
          saveLocalGroups(next);
          setGroups(next);
          setActiveGroupId(ensured.id);
          if (isCloudSyncEnabled()) {
            void syncGroupToCloud(ensured);
          }
          showNotice(`🎉 已完整還原「${ensured.name}」所有成員與帳目！`);
        }}
        onImportGroupsBackup={(importedList) => {
          const allSaved = loadLocalGroups();
          const merged = deduplicateGroupsKeepingNewest([
            ...importedList.map((g) => ensureGroupSyncKey(g)),
            ...allSaved,
          ]);
          saveLocalGroups(merged);
          setGroups(merged);
          if (importedList[0]) {
            setActiveGroupId(importedList[0].id);
          }
          if (isCloudSyncEnabled()) {
            importedList.forEach((g) => void syncGroupToCloud(g));
          }
          showNotice(`🎉 已匯入並永久備份 ${importedList.length} 個分帳群組！`);
        }}
      />

      {/* Confirm Delete Popup Modal (Confirm / Cancel) */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">
                {pendingDelete.type === 'member'
                  ? '確認刪除此成員？'
                  : pendingDelete.type === 'expense'
                  ? '確認刪除此筆消費？'
                  : '確認永久刪除此分帳群組？'}
              </h3>
              <div className="text-sm font-bold text-rose-600">
                「{pendingDelete.name}」
              </div>
              {pendingDelete.detail && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {pendingDelete.detail}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeConfirmedDelete}
                className="py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-500/20 transition"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
