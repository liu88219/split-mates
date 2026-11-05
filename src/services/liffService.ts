import liff from '@line/liff';
import { BillGroup, SimplifiedTransfer } from '../types/bill';
import { formatMoney } from '../utils/currencies';

const LIFF_ID_STORAGE_KEY = 'splitmates_liff_id_v1';

export type ClientPlatform = 'line_liff' | 'line_inapp' | 'instagram_inapp' | 'web';

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

let isLiffReady = false;

export function getActiveLiffId(): string {
  try {
    const saved = localStorage.getItem(LIFF_ID_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore
  }
  const env = (import.meta as unknown as { env: Record<string, string> }).env || {};
  return env.VITE_LIFF_ID ? env.VITE_LIFF_ID.trim() : '';
}

export function saveCustomLiffId(liffId: string): void {
  const clean = liffId.trim();
  if (!clean) {
    localStorage.removeItem(LIFF_ID_STORAGE_KEY);
    isLiffReady = false;
    return;
  }
  localStorage.setItem(LIFF_ID_STORAGE_KEY, clean);
}

/**
 * 偵測使用者目前開啟網頁的環境（LINE 內建瀏覽器 / IG 內建瀏覽器 / 一般瀏覽器）
 */
export function detectClientPlatform(): ClientPlatform {
  const ua = navigator.userAgent || '';
  if (/Line\//i.test(ua)) {
    return isLiffReady ? 'line_liff' : 'line_inapp';
  }
  if (/Instagram/i.test(ua)) {
    return 'instagram_inapp';
  }
  return 'web';
}

/**
 * 初始化 LINE LIFF SDK（若有設定 LIFF ID）
 */
export async function initLineLiff(): Promise<{
  ready: boolean;
  profile: LineUserProfile | null;
}> {
  const liffId = getActiveLiffId();
  if (!liffId) {
    return { ready: false, profile: null };
  }

  try {
    if (!isLiffReady) {
      await liff.init({ liffId });
      isLiffReady = true;
    }
    if (liff.isLoggedIn()) {
      const p = await liff.getProfile();
      return {
        ready: true,
        profile: {
          userId: p.userId,
          displayName: p.displayName,
          pictureUrl: p.pictureUrl,
        },
      };
    }
    return { ready: true, profile: null };
  } catch (err) {
    console.warn('LINE LIFF init skipped or failed:', err);
    return { ready: false, profile: null };
  }
}

export function triggerLineLogin(): void {
  if (!isLiffReady) return;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
  }
}

/**
 * 透過 LINE LIFF `shareTargetPicker` 一鍵傳送精美 Flex Message 分帳卡片給 LINE 好友或群組
 */
export async function shareFlexCardToLine(
  group: BillGroup,
  transfers: SimplifiedTransfer[],
  shareUrl: string
): Promise<{ ok: boolean; message: string }> {
  if (!isLiffReady) {
    // 若尚未設定 LIFF ID，退回使用 LINE 官方 URL Scheme 直接喚起 LINE 分享視窗
    const fallbackText = `${group.coverEmoji} 【${group.name}】分帳結算單\n點開連結查看帳目與轉帳明細：\n${shareUrl}`;
    const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(fallbackText)}`;
    window.open(lineShareUrl, '_blank', 'noopener,noreferrer');
    return {
      ok: true,
      message: '已開啟 LINE 好友/群組轉發視窗！',
    };
  }

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return { ok: false, message: '請先完成 LINE 登入授權' };
  }

  const totalSpend = group.expenses.reduce((s, e) => s + e.baseAmount, 0);
  const transferContents =
    transfers.length === 0
      ? [
          {
            type: 'text' as const,
            text: '🎉 所有帳目皆已結清！',
            color: '#059669',
            weight: 'bold' as const,
            size: 'sm' as const,
          },
        ]
      : transfers.slice(0, 8).map((t) => ({
          type: 'box' as const,
          layout: 'horizontal' as const,
          margin: 'sm' as const,
          contents: [
            {
              type: 'text' as const,
              text: `${t.fromMemberName} ➜ ${t.toMemberName}`,
              size: 'sm' as const,
              color: '#334155',
              flex: 3,
            },
            {
              type: 'text' as const,
              text: formatMoney(t.amount, group.baseCurrency),
              size: 'sm' as const,
              color: '#e11d48',
              weight: 'bold' as const,
              align: 'end' as const,
              flex: 2,
            },
          ],
        }));

  try {
    if (liff.isApiAvailable('shareTargetPicker')) {
      const res = await liff.shareTargetPicker([
        {
          type: 'flex',
          altText: `${group.coverEmoji} 【${group.name}】分帳結算單`,
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#1e1b4b',
              contents: [
                {
                  type: 'text',
                  text: 'SPLITMATES 好友分帳',
                  color: '#a5b4fc',
                  size: 'xs',
                  weight: 'bold',
                },
                {
                  type: 'text',
                  text: `${group.coverEmoji} ${group.name}`,
                  color: '#ffffff',
                  size: 'lg',
                  weight: 'bold',
                  margin: 'xs',
                },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '群組總花費',
                      size: 'sm',
                      color: '#64748b',
                    },
                    {
                      type: 'text',
                      text: formatMoney(Math.round(totalSpend), group.baseCurrency),
                      size: 'md',
                      weight: 'bold',
                      color: '#0f172a',
                      align: 'end',
                    },
                  ],
                },
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'text',
                  text: '⚡ 建議轉帳明細',
                  size: 'xs',
                  color: '#6366f1',
                  weight: 'bold',
                  margin: 'md',
                },
                ...transferContents,
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#4f46e5',
                  action: {
                    type: 'uri',
                    label: '點開查看明細 / 新增帳目',
                    uri: shareUrl,
                  },
                },
              ],
            },
          },
        },
      ]);
      if (res) {
        return { ok: true, message: '已成功透過 LINE 傳送分帳卡片！' };
      }
      return { ok: false, message: '已取消分享' };
    }
  } catch (err) {
    console.warn('LIFF shareTargetPicker failed:', err);
  }

  const fallbackText = `${group.coverEmoji} 【${group.name}】分帳結算單\n${shareUrl}`;
  window.open(
    `https://line.me/R/msg/text/?${encodeURIComponent(fallbackText)}`,
    '_blank',
    'noopener,noreferrer'
  );
  return { ok: true, message: '已開啟 LINE 分享視窗！' };
}
