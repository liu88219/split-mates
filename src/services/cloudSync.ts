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
const RELAY_BASE_URL = 'https://ntfy.sh';

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

function getGroupRelayTopic(groupId: string, syncKey?: string): string | null {
  if (!syncKey || groupId === 'tokyo-trip-demo') {
    return null;
  }
  const safeKey = syncKey.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeId = groupId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (safeKey.length < 8) {
    return null;
  }
  return `splitmates_sync_v2_${safeKey}_${safeId}`;
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
 * 將群組資料儲存至本機 LocalStorage
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

export function saveLocalGroups(groups: BillGroup[]): void {
  try {
    localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
  } catch (err) {
    console.warn('Failed to save groups to localStorage:', err);
  }
}

/**
 * 將單一群組同步至雲端（內建私密金鑰即時同步通道 + 選配 Firebase Firestore）
 */
export async function syncGroupToCloud(group: BillGroup): Promise<boolean> {
  let ok = false;
  const ensured = ensureGroupSyncKey(group);
  const payload = { ...ensured, updatedAt: ensured.updatedAt || Date.now() };

  // 1. Built-in real-time cloud channel scoped by per-group random syncKey
  try {
    const primaryTopic = getGroupRelayTopic(payload.id, payload.syncKey);
    if (primaryTopic) {
      const compressed = encodeGroupForRelay(payload);
      const res = await fetch(`${RELAY_BASE_URL}/${primaryTopic}`, {
        method: 'POST',
        body: compressed,
      });
      if (res.ok) {
        ok = true;
      }
    }
  } catch (err) {
    console.warn('Relay cloud sync warning:', err);
  }

  // 2. Optional Firebase Firestore sync if configured
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
 * 從雲端單次拉取特定群組最新狀態
 */
export async function fetchGroupFromCloud(
  groupId: string,
  syncKey?: string
): Promise<BillGroup | null> {
  let latestGroup: BillGroup | null = null;

  // 1. Pull from built-in real-time cloud channel if syncKey is available
  const topic = getGroupRelayTopic(groupId, syncKey);
  if (topic) {
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
              const decoded = decodeGroupFromRelay(evt.message);
              if (
                decoded &&
                (!latestGroup || decoded.updatedAt >= latestGroup.updatedAt)
              ) {
                latestGroup = {
                  ...decoded,
                  id: groupId,
                  syncKey: decoded.syncKey || syncKey,
                };
              }
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    } catch (err) {
      console.warn('Relay cloud fetch warning:', err);
    }
  }

  // 2. Also check Firebase Firestore if configured
  const db = initCloudFirestore();
  if (db) {
    try {
      const ref = doc(db, 'splitmates_groups', groupId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const fbGroup = snap.data() as BillGroup;
        if (!latestGroup || fbGroup.updatedAt >= latestGroup.updatedAt) {
          latestGroup = fbGroup;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch group from Firestore:', err);
    }
  }

  return latestGroup;
}

/**
 * 訂閱雲端群組即時更新 (SSE 即時推播 + 定時輪詢備援 + Firestore onSnapshot)
 */
export function subscribeToCloudGroup(
  groupId: string,
  syncKey: string | undefined,
  onUpdate: (group: BillGroup) => void
): Unsubscribe | null {
  const cleanups: Array<() => void> = [];
  const topic = getGroupRelayTopic(groupId, syncKey);

  // 1. Real-time Server-Sent Events (SSE) stream
  if (topic && typeof EventSource !== 'undefined') {
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

  // 2. Periodic poll every 5 seconds (keeps LINE / IG in-app browsers in sync after wake)
  if (topic || initCloudFirestore()) {
    const intervalId = window.setInterval(() => {
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
  }

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
 * 產生可直接在 LINE / IG 點開的分享連結：
 * 同時支援私密金鑰雲端即時同步通道 (`?group=<id>&k=<syncKey>&mode=shared`) 與網址壓縮備援 (`&s=...`)
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
  try {
    const compressed = encodeGroupForRelay(ensured);
    if (compressed.length <= 2600) {
      params.set('s', compressed);
    }
  } catch {
    // ignore
  }
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
