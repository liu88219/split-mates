import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import LZString from 'lz-string';
import { BillGroup } from '../types/bill';

const LOCAL_GROUPS_KEY = 'splitmates_groups_v1';
const FIREBASE_CONFIG_STORAGE_KEY = 'splitmates_firebase_config_v1';
const OWNER_PASSHASH_STORAGE_KEY = 'splitmates_owner_passhash_v1';
const DELETED_GROUPS_STORAGE_KEY = 'splitmates_deleted_groups_v1';
const RELAY_BASE_URL = 'https://ntfy.sh';
const TEXTDB_UPDATE_URL = 'https://api.textdb.online/update/';
const TEXTDB_READ_URL = 'https://textdb.online';
const IDB_NAME = 'SplitMatesDB';
const IDB_STORE = 'kv';
const IDB_GROUPS_KEY = 'groups_v1';

export interface FirebaseConfigInput {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

let firestoreDb: Firestore | null = null;
let activeProjectId: string | null = null;

/**
 * 產生不可預測的隨機群組同步金鑰（僅保存於本機與私密分享連結中，不寫死於公開程式碼）
 */
export function generateSyncKey(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }
  let out = '';
  for (let i = 0; i < 20; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function ensureGroupSyncKey(group: BillGroup): BillGroup {
  if (group.id === 'tokyo-trip-demo' || group.syncKey) {
    return group;
  }
  return {
    ...group,
    syncKey: generateSyncKey(),
  };
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * 取得群組對應的所有即時推播通道 (ntfy.sh)：
 * 同時包含「群組 ID 固定通道」（確保主畫面 App、Safari 與舊版分享連結皆能互通）與「私密金鑰通道」
 */
function getGroupRelayTopics(groupId: string, syncKey?: string): string[] {
  if (!groupId || groupId === 'tokyo-trip-demo') {
    return [];
  }
  const safeId = sanitizeId(groupId);
  const topics = [`splitmates_sync_grp_v3_${safeId}`];
  if (syncKey) {
    const safeKey = syncKey.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeKey.length >= 8) {
      topics.unshift(`splitmates_sync_v2_${safeKey}_${safeId}`);
    }
  }
  return Array.from(new Set(topics));
}

/**
 * 取得群組對應的永久雲端儲存鍵值 (textdb.online，無 12 小時過期限制)
 */
function getGroupPermanentKeys(groupId: string, syncKey?: string): string[] {
  if (!groupId || groupId === 'tokyo-trip-demo') {
    return [];
  }
  const safeId = sanitizeId(groupId);
  const keys = [`splitmates_perm_grp_v3_${safeId}`];
  if (syncKey) {
    const safeKey = syncKey.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeKey.length >= 8) {
      keys.unshift(`splitmates_perm_k_v3_${safeKey}_${safeId}`);
    }
  }
  return Array.from(new Set(keys));
}

async function writeTextDb(key: string, value: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({ key, value }).toString();
    const res = await fetch(TEXTDB_UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function readTextDb(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${TEXTDB_READ_URL}/${encodeURIComponent(key)}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function encodeGroupForRelay(group: BillGroup): string {
  const fullCompressed = LZString.compressToEncodedURIComponent(JSON.stringify(group));
  if (fullCompressed.length <= 3700) {
    return fullCompressed;
  }
  // If coverImageUrl is a large unresized base64 image, omit it from relay payload to stay under 4KB inline limit
  const slimGroup: BillGroup = { ...group, coverImageUrl: undefined };
  return LZString.compressToEncodedURIComponent(JSON.stringify(slimGroup));
}

function encodeGroupForPermanentCloud(group: BillGroup): string {
  const safeGroup: BillGroup =
    group.coverImageUrl && group.coverImageUrl.length > 35000
      ? { ...group, coverImageUrl: undefined }
      : group;
  return LZString.compressToEncodedURIComponent(JSON.stringify(safeGroup));
}

function decodeGroupFromRelay(compressed: string): BillGroup | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed.trim());
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (parsed && parsed.id && Array.isArray(parsed.members) && Array.isArray(parsed.expenses)) {
      return parsed as BillGroup;
    }
  } catch {
    // ignore invalid message
  }
  return null;
}

/**
 * 讀取目前有效的 Firebase 設定（優先讀取使用者於網頁內設定之 Config，其次讀取 .env 環境變數）
 */
export function getActiveFirebaseConfig(): FirebaseConfigInput | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const env = (import.meta as unknown as { env: Record<string, string> }).env || {};
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
  }
  return null;
}

export function saveCustomFirebaseConfig(config: FirebaseConfigInput | null): void {
  if (!config || !config.apiKey || !config.projectId) {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    firestoreDb = null;
    activeProjectId = null;
    return;
  }
  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  firestoreDb = null;
  activeProjectId = null;
  initCloudFirestore();
}

export function initCloudFirestore(): Firestore | null {
  const cfg = getActiveFirebaseConfig();
  if (!cfg) return null;
  if (firestoreDb && activeProjectId === cfg.projectId) {
    return firestoreDb;
  }

  try {
    let app: FirebaseApp;
    const existing = getApps().find((a) => a.options.projectId === cfg.projectId);
    if (existing) {
      app = existing;
    } else {
      app = initializeApp(cfg, `splitmates-${cfg.projectId}`);
    }
    firestoreDb = getFirestore(app);
    activeProjectId = cfg.projectId;
    return firestoreDb;
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
    return null;
  }
}

/**
 * 預設即啟用內建免設定雲端即時同步通道 (Relay SSE + Poll)，若另有設定 Firebase 亦會雙重同步
 */
export function isCloudSyncEnabled(): boolean {
  return true;
}

/**
 * 向瀏覽器申請「永久儲存權限 (Persistent Storage)」，降低 iOS Safari / 手機瀏覽器久未開啟自動清除快取的機率
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      const alreadyPersisted =
        typeof navigator.storage.persisted === 'function'
          ? await navigator.storage.persisted()
          : false;
      if (alreadyPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

function openSplitMatesDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function mirrorGroupsToIndexedDB(groups: BillGroup[]): Promise<void> {
  const db = await openSplitMatesDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(groups, IDB_GROUPS_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/**
 * 當 LocalStorage 因 LINE / IG 內建瀏覽器清理快取而遺失時，自動從 IndexedDB 雙重備份救回帳本
 */
export async function recoverGroupsFromIndexedDB(): Promise<BillGroup[] | null> {
  const db = await openSplitMatesDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_GROUPS_KEY);
      req.onsuccess = () => {
        const val = req.result;
        db.close();
        if (Array.isArray(val) && val.length > 0) {
          resolve(val as BillGroup[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * 將群組資料讀取自本機 LocalStorage
 */
export function loadLocalGroups(): BillGroup[] {
  try {
    const raw = localStorage.getItem(LOCAL_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 將群組資料同時寫入 LocalStorage 與 IndexedDB 雙重本機資料庫（無過期時間限制）
 */
export function saveLocalGroups(groups: BillGroup[]): void {
  try {
    localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
  } catch (err) {
    console.warn('Failed to save groups to localStorage:', err);
  }
  void mirrorGroupsToIndexedDB(groups);
}

/**
 * 匯出所有帳本為 .json 永久備份檔供下載保存
 */
export function exportAllGroupsJson(groups: BillGroup[]): void {
  const payload = {
    app: 'SplitMates',
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: groups.map((g) => ensureGroupSyncKey(g)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SplitMates_分帳備份_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 解析匯入的 .json 備份檔
 */
export function parseImportedGroupsJson(rawText: string): BillGroup[] {
  const parsed = JSON.parse(rawText);
  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.groups)
    ? parsed.groups
    : parsed && parsed.id && Array.isArray(parsed.members)
    ? [parsed]
    : [];

  return rawList
    .filter((item): item is BillGroup => {
      if (!item || typeof item !== 'object') return false;
      const g = item as Partial<BillGroup>;
      return (
        typeof g.id === 'string' &&
        typeof g.name === 'string' &&
        Array.isArray(g.members) &&
        Array.isArray(g.expenses)
      );
    })
    .map((g) => ensureGroupSyncKey(g));
}

/**
 * 將單一群組同步至雲端：
 * 1. 永久雲端 KV 儲存 (textdb.online — 不會因 12 小時未使用而失效，確保分享連結永久有效)
 * 2. 即時推播通道 (ntfy.sh SSE — 雙方同時在線上時 1 秒內即時跳出更新)
 * 3. 選配 Firebase Firestore
 */
export async function syncGroupToCloud(group: BillGroup): Promise<boolean> {
  if (group.id === 'tokyo-trip-demo') return false;
  let ok = false;
  const ensured = ensureGroupSyncKey(group);
  const payload: BillGroup = { ...ensured, updatedAt: ensured.updatedAt || Date.now() };

  // 1. Permanent Cloud KV Store (never expires after 12h; bridges Home Screen App, Safari & Share Links)
  try {
    const permCompressed = encodeGroupForPermanentCloud(payload);
    const permKeys = getGroupPermanentKeys(payload.id, payload.syncKey);
    // If user edited a group named 高雄之旅 with a custom id, also mirror to kaohsiung-trip permanent key ONLY if id === 'kaohsiung-trip'
    const results = await Promise.all(
      permKeys.map((k) => writeTextDb(k, permCompressed))
    );
    if (results.some(Boolean)) {
      ok = true;
    }
  } catch (err) {
    console.warn('Permanent cloud sync warning:', err);
  }

  // 2. Real-time live SSE relay channels
  try {
    const relayCompressed = encodeGroupForRelay(payload);
    const relayTopics = getGroupRelayTopics(payload.id, payload.syncKey);
    const relayResults = await Promise.all(
      relayTopics.map(async (topic) => {
        try {
          const res = await fetch(`${RELAY_BASE_URL}/${topic}`, {
            method: 'POST',
            body: relayCompressed,
          });
          return res.ok;
        } catch {
          return false;
        }
      })
    );
    if (relayResults.some(Boolean)) {
      ok = true;
    }
  } catch (err) {
    console.warn('Relay cloud sync warning:', err);
  }

  // 3. Optional Firebase Firestore sync if configured
  const db = initCloudFirestore();
  if (db) {
    try {
      const ref = doc(db, 'splitmates_groups', payload.id);
      await setDoc(ref, payload, { merge: true });
      ok = true;
    } catch (err) {
      console.warn('Failed to sync group to Firestore:', err);
    }
  }

  return ok;
}

/**
 * 從雲端單次拉取特定群組最新狀態（同時比對永久雲端儲存與即時通道，永遠採用最新 updatedAt 版本）
 */
export async function fetchGroupFromCloud(
  groupId: string,
  syncKey?: string
): Promise<BillGroup | null> {
  if (!groupId || groupId === 'tokyo-trip-demo') return null;
  let latestGroup: BillGroup | null = null;

  const considerCandidate = (candidate: BillGroup | null) => {
    if (!candidate) return;
    if (!latestGroup || (candidate.updatedAt || 0) >= (latestGroup.updatedAt || 0)) {
      latestGroup = {
        ...candidate,
        id: groupId,
        syncKey: candidate.syncKey || syncKey,
        coverImageUrl: candidate.coverImageUrl || latestGroup?.coverImageUrl,
      };
    }
  };

  // 1. Pull from Permanent Cloud KV Store (never expires!)
  const permKeys = getGroupPermanentKeys(groupId, syncKey);
  await Promise.all(
    permKeys.map(async (k) => {
      const raw = await readTextDb(k);
      if (raw) {
        considerCandidate(decodeGroupFromRelay(raw));
      }
    })
  );

  // 2. Pull from real-time relay channels (recent 12h live messages)
  const relayTopics = getGroupRelayTopics(groupId, syncKey);
  await Promise.all(
    relayTopics.map(async (topic) => {
      try {
        const res = await fetch(`${RELAY_BASE_URL}/${topic}/json?poll=1&since=12h`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const text = await res.text();
          const lines = text.split('\n').filter((line) => line.trim().length > 0);
          for (const line of lines) {
            try {
              const evt = JSON.parse(line);
              if (evt && evt.event === 'message' && typeof evt.message === 'string') {
                considerCandidate(decodeGroupFromRelay(evt.message));
              }
            } catch {
              // ignore malformed line
            }
          }
        }
      } catch {
        // ignore network warning
      }
    })
  );

  // 3. Also check Firebase Firestore if configured
  const db = initCloudFirestore();
  if (db) {
    try {
      const ref = doc(db, 'splitmates_groups', groupId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        considerCandidate(snap.data() as BillGroup);
      }
    } catch (err) {
      console.warn('Failed to fetch group from Firestore:', err);
    }
  }

  return latestGroup;
}

/**
 * 訂閱雲端群組即時更新 (SSE 即時推播 + 定時輪詢永久雲端儲存 + Firestore onSnapshot)
 */
export function subscribeToCloudGroup(
  groupId: string,
  syncKey: string | undefined,
  onUpdate: (group: BillGroup) => void
): Unsubscribe | null {
  if (!groupId || groupId === 'tokyo-trip-demo') return null;
  const cleanups: Array<() => void> = [];
  const relayTopics = getGroupRelayTopics(groupId, syncKey);

  // 1. Real-time Server-Sent Events (SSE) stream on group channel(s)
  if (relayTopics.length > 0 && typeof EventSource !== 'undefined') {
    for (const topic of relayTopics) {
      try {
        const es = new EventSource(`${RELAY_BASE_URL}/${topic}/sse`);
        es.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt && evt.event === 'message' && typeof evt.message === 'string') {
              const decoded = decodeGroupFromRelay(evt.message);
              if (decoded) {
                onUpdate({
                  ...decoded,
                  id: groupId,
                  syncKey: decoded.syncKey || syncKey,
                });
              }
            }
          } catch {
            // ignore
          }
        };
        cleanups.push(() => es.close());
      } catch {
        // ignore EventSource errors
      }
    }
  }

  // 2. Periodic poll every 5 seconds against Permanent Cloud KV + Relay (keeps iOS Home Screen, Safari & LINE in sync)
  const intervalId = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    fetchGroupFromCloud(groupId, syncKey).then((remote) => {
      if (remote) {
        onUpdate({
          ...remote,
          id: groupId,
          syncKey: remote.syncKey || syncKey,
        });
      }
    });
  }, 5000);
  cleanups.push(() => window.clearInterval(intervalId));

  // 3. Optional Firebase Firestore listener
  const db = initCloudFirestore();
  if (db) {
    try {
      const ref = doc(db, 'splitmates_groups', groupId);
      const unsubFb = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            onUpdate(snap.data() as BillGroup);
          }
        },
        (err) => {
          console.warn('Firestore snapshot listener error:', err);
        }
      );
      cleanups.push(unsubFb);
    } catch {
      // ignore
    }
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}

/**
 * 記錄已刪除的群組墓碑時間戳，避免跨瀏覽器（桌面主畫面 App ↔ Safari）同步時把已刪群組復活
 */
export function recordDeletedGroupTombstone(groupId: string): void {
  try {
    const map = getDeletedGroupTombstones();
    map[groupId] = Date.now();
    localStorage.setItem(DELETED_GROUPS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getDeletedGroupTombstones(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DELETED_GROUPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function deriveOwnerVaultKey(): Promise<string | null> {
  try {
    const passhash = localStorage.getItem(OWNER_PASSHASH_STORAGE_KEY);
    if (!passhash || passhash.length < 8) return null;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(`splitmates_owner_vault_v1:${passhash}`);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `splitmates_vault_v1_${hex.slice(0, 36)}`;
    }
    return `splitmates_vault_v1_${sanitizeId(passhash).slice(0, 36)}`;
  } catch {
    return null;
  }
}

interface OwnerVaultPayload {
  vaultUpdatedAt: number;
  activeGroupId: string;
  deletedGroupIds?: Record<string, number>;
  groups: BillGroup[];
}

/**
 * 管理員跨瀏覽器雲端保險箱同步（讓 iPhone「加入主畫面 App」、Safari 與電腦瀏覽器自動同步所有帳本清單）
 * 僅在裝置已設定相同的管理密碼雜湊時啟用，金鑰由 SHA-256 不可逆雜湊衍生，公開程式碼零機密
 */
export async function syncOwnerVaultWithCloud(
  localGroups: BillGroup[],
  localActiveGroupId: string,
  preferLocalActiveId = false
): Promise<{ groups: BillGroup[]; activeGroupId: string } | null> {
  const vaultKey = await deriveOwnerVaultKey();
  if (!vaultKey) return null;

  const localDeleted = getDeletedGroupTombstones();
  let remoteVault: OwnerVaultPayload | null = null;

  const rawRemote = await readTextDb(vaultKey);
  if (rawRemote) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(rawRemote);
      if (json) {
        const parsed = JSON.parse(json);
        if (parsed && Array.isArray(parsed.groups)) {
          remoteVault = parsed as OwnerVaultPayload;
        }
      }
    } catch {
      // ignore invalid remote vault
    }
  }

  // Merge deleted tombstones
  const mergedDeleted: Record<string, number> = {
    ...(remoteVault?.deletedGroupIds || {}),
  };
  for (const [gid, ts] of Object.entries(localDeleted)) {
    mergedDeleted[gid] = Math.max(mergedDeleted[gid] || 0, ts);
  }
  try {
    localStorage.setItem(DELETED_GROUPS_STORAGE_KEY, JSON.stringify(mergedDeleted));
  } catch {
    // ignore
  }

  // Merge groups keeping newest updatedAt per group ID and respecting tombstones
  const byId = new Map<string, BillGroup>();
  const allCandidates = [...(remoteVault?.groups || []), ...localGroups];
  for (const rawGrp of allCandidates) {
    if (!rawGrp || !rawGrp.id) continue;
    const grp = ensureGroupSyncKey(rawGrp);
    const deletedAt = mergedDeleted[grp.id] || 0;
    if (deletedAt > (grp.updatedAt || 1000)) {
      continue;
    }
    const existing = byId.get(grp.id);
    if (!existing) {
      byId.set(grp.id, grp);
    } else {
      const existingTs = existing.updatedAt || 1000;
      const candidateTs = grp.updatedAt || 1000;
      if (candidateTs > existingTs) {
        byId.set(grp.id, {
          ...grp,
          coverImageUrl: grp.coverImageUrl || existing.coverImageUrl,
        });
      } else if (candidateTs === existingTs && !existing.coverImageUrl && grp.coverImageUrl) {
        byId.set(grp.id, grp);
      }
    }
  }

  const mergedGroups = Array.from(byId.values()).sort(
    (a, b) => (b.updatedAt || 1000) - (a.updatedAt || 1000)
  );
  if (mergedGroups.length === 0) return null;

  // Determine best activeGroupId
  let nextActiveId = localActiveGroupId;
  const localActiveGrp = localGroups.find((g) => g.id === localActiveGroupId);
  const localIsUnedited = !localActiveGrp || (localActiveGrp.updatedAt || 1000) <= 1000;

  if (
    !preferLocalActiveId &&
    localIsUnedited &&
    remoteVault?.activeGroupId &&
    mergedGroups.some((g) => g.id === remoteVault!.activeGroupId && !g.isArchived)
  ) {
    nextActiveId = remoteVault.activeGroupId;
  } else if (!mergedGroups.some((g) => g.id === nextActiveId)) {
    const firstActive = mergedGroups.find((g) => !g.isArchived && g.id !== 'tokyo-trip-demo');
    nextActiveId = firstActive?.id || mergedGroups[0].id;
  }

  // Push merged vault back to cloud if we have any edited non-demo group or tombstones
  const hasRealContent =
    Object.keys(mergedDeleted).length > 0 ||
    mergedGroups.some((g) => (g.updatedAt || 1000) > 1000);

  if (hasRealContent) {
    const slimVaultGroups = mergedGroups.map((g) =>
      g.coverImageUrl && g.coverImageUrl.length > 15000
        ? { ...g, coverImageUrl: undefined }
        : g
    );
    const payloadToSave: OwnerVaultPayload = {
      vaultUpdatedAt: Date.now(),
      activeGroupId: nextActiveId,
      deletedGroupIds: mergedDeleted,
      groups: slimVaultGroups,
    };
    const compressedVault = LZString.compressToEncodedURIComponent(
      JSON.stringify(payloadToSave)
    );
    await writeTextDb(vaultKey, compressedVault);
  }

  return {
    groups: mergedGroups,
    activeGroupId: nextActiveId,
  };
}

/**
 * 產生可直接在 LINE / IG 點開且永久有效的精簡分享連結：
 * 帳目資料永久保存在雲端 KV (textdb.online) 並透過即時通道同步，
 * 連結長度僅約 90 字元，在 LINE / IG 聊天室絕不會被截斷、QR Code 秒掃、且永不過期！
 */
export function buildShareableGroupUrl(group: BillGroup): string {
  const ensured = ensureGroupSyncKey(group);
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set('group', ensured.id);
  if (ensured.syncKey) {
    params.set('k', ensured.syncKey);
  }
  params.set('mode', 'shared');
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 解析網址上的 `?group=...&k=...&mode=shared&s=...` 參數
 */
export function parseGroupFromUrl(): {
  groupId: string | null;
  syncKey: string | null;
  sharedGroup: BillGroup | null;
  isSharedLink: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('group');
  const syncKey = params.get('k');
  const compressed = params.get('s');
  // Only treat as a restricted friend-shared link when mode=shared is explicitly in the URL
  const isSharedLink = params.get('mode') === 'shared';

  let sharedGroup: BillGroup | null = null;
  if (compressed) {
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (json) {
        const parsed = JSON.parse(json);
        if (parsed && parsed.id && Array.isArray(parsed.members)) {
          sharedGroup = {
            ...(parsed as BillGroup),
            syncKey: (parsed as BillGroup).syncKey || syncKey || undefined,
          };
        }
      }
    } catch (err) {
      console.warn('Failed to parse shared group from URL:', err);
    }
  }

  return { groupId, syncKey, sharedGroup, isSharedLink };
}
