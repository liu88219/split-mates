import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  MessageCircle,
  Image as ImageIcon,
  FileText,
  Link2,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { BillGroup, MemberBalance, SimplifiedTransfer } from '../types/bill';
import { generateLineIgSummaryText } from '../utils/settlement';
import { renderSettlementCardToDataUrl } from '../utils/cardGenerator';
import { shareFlexCardToLine } from '../services/liffService';
import { syncGroupToCloud } from '../services/cloudSync';
import { QuokkaFaceBadge } from './QuokkaBoboArt';

interface ShareCardModalProps {
  isOpen: boolean;
  group: BillGroup;
  balances: MemberBalance[];
  transfers: SimplifiedTransfer[];
  shareUrl: string;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  group,
  balances,
  transfers,
  shareUrl,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'link'>('image');
  const [cardDataUrl, setCardDataUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const summaryText = generateLineIgSummaryText(group, balances, transfers, shareUrl);

  useEffect(() => {
    if (!isOpen) return;
    // 打開分享中心時立即將本群組最新狀態寫入永久雲端儲存，確保分享出去的連結 100% 永久有效
    void syncGroupToCloud(group);
    const url = renderSettlementCardToDataUrl(group, balances, transfers);
    setCardDataUrl(url);
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#3E2C1E', light: '#FFFDF9' },
    })
      .then((qr) => setQrDataUrl(qr))
      .catch(() => setQrDataUrl(''));
  }, [isOpen, group, balances, transfers, shareUrl]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedText(true);
      showToast('✅ 已複製結算文字！可直接貼到 LINE 群組或 IG 小盒子');
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      showToast('請長按文字框手動全選複製');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      showToast('✅ 已複製共同分帳連結！貼到 IG 或 LINE 即可讓好友點開');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('請手動複製連結');
    }
  };

  const handleDownloadCard = () => {
    if (!cardDataUrl) return;
    const a = document.createElement('a');
    a.href = cardDataUrl;
    a.download = `${group.name}-奶油結算小卡.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('🍪 已下載高畫質 Quokka & BOBO 奶油結算小卡！');
  };

  const handleNativeShareImage = async () => {
    if (!cardDataUrl) return;
    try {
      const res = await fetch(cardDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${group.name}-結算單.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${group.coverEmoji} ${group.name} 分帳結算單`,
          text: summaryText,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: `${group.coverEmoji} ${group.name} 分帳結算單`,
          text: summaryText,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // User cancelled or browser unsupported; fallback to download
    }
    handleDownloadCard();
  };

  const handleLineShare = async () => {
    const res = await shareFlexCardToLine(group, transfers, shareUrl);
    if (res.message) {
      showToast(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3E2C1E]/45 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFFDF9] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-2 border-[#3E2C1E] shadow-[0_8px_0_#3E2C1E] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FAF1E2] border-b-2 border-[#E6D4BE] text-[#3E2C1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <QuokkaFaceBadge className="w-8 h-8 shrink-0" />
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              📲 LINE & IG 奶油結算分享中心
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

        {/* Sub-navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#F4ECE0] border-b border-[#E6D5C1] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'image'
                ? 'bg-[#FFFDF9] text-[#8F4D22] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                : 'text-[#7A624E] hover:text-[#3E2C1E]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>奶油結算小卡</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'text'
                ? 'bg-[#FFFDF9] text-[#8F4D22] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                : 'text-[#7A624E] hover:text-[#3E2C1E]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>LINE / IG 文字</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'link'
                ? 'bg-[#FFFDF9] text-[#8F4D22] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E]'
                : 'text-[#7A624E] hover:text-[#3E2C1E]'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>共同記帳連結</span>
          </button>
        </div>

        {toastMsg && (
          <div className="mx-5 mt-3 px-4 py-2.5 rounded-2xl bg-[#3E2C1E] text-[#FFFDF9] text-xs font-bold text-center shadow-md">
            {toastMsg}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'image' && (
            <div className="space-y-4">
              <p className="text-xs text-[#6E5643] leading-relaxed">
                自動將目前帳目繪製為高畫質 <strong>Quokka &amp; BOBO 簡約奶油結算小卡</strong>，可直接傳進 <strong>IG 小盒子</strong>、<strong>IG 限時動態</strong> 或 <strong>LINE 群組</strong>（在手機內也可長按圖片儲存）：
              </p>

              <div className="rounded-2xl overflow-hidden border-2 border-[#E5D4BE] bg-[#F4EAE0] p-2 flex justify-center">
                {cardDataUrl ? (
                  <img
                    src={cardDataUrl}
                    alt="分帳結算圖片小卡"
                    className="w-full max-h-[380px] object-contain rounded-xl"
                  />
                ) : (
                  <div className="py-16 text-[#8C735D] text-sm font-bold">
                    正在烤製奶油結算小卡...
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleNativeShareImage}
                  className="py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 btn-butter"
                >
                  <Share2 className="w-4 h-4" />
                  傳送到 IG / LINE (原生分享)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  className="py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 btn-quokka"
                >
                  <Download className="w-4 h-4" />
                  下載奶油結算小卡 (PNG)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <p className="text-xs text-[#6E5643]">
                已自動排版成適合手機閱讀的清單（含最少轉帳建議、每人淨額與收款帳號）：
              </p>
              <textarea
                readOnly
                rows={11}
                value={summaryText}
                className="w-full p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-[#E5D5C1] text-xs font-mono text-[#3E2C1E] leading-relaxed focus:outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 btn-quokka"
                >
                  {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedText ? '已複製結算文字！' : '一鍵複製文字 (貼到 IG / LINE)'}
                </button>
                <button
                  type="button"
                  onClick={handleLineShare}
                  className="py-3 px-4 rounded-2xl bg-[#06C755] hover:bg-[#05B34C] text-white border-2 border-[#3E2C1E] shadow-[0_3px_0_#3E2C1E] active:translate-y-[1px] active:shadow-[0_1px_0_#3E2C1E] font-extrabold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  一鍵轉發到 LINE 聊天室
                </button>
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-4">
              {qrDataUrl && (
                <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-[#E5D5C1] flex flex-col items-center text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#8F4D22]">
                    <QrCode className="w-4 h-4" />
                    <span>手機相機 / LINE 掃描 QR Code 立即開啟本群組</span>
                  </div>
                  <img
                    src={qrDataUrl}
                    alt="群組手機開啟 QR Code"
                    className="w-44 h-44 rounded-2xl border-2 border-[#3E2C1E] shadow-[0_3px_0_#EAE0D2] bg-[#FFFDF9] p-2"
                  />
                  <span className="text-[11px] text-[#7A624E]">
                    面對面聚餐時，讓朋友直接掃描就能進來同一個分帳本！
                  </span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-[#FFF7DC] border-2 border-[#EAD084] space-y-2">
                <h3 className="text-sm font-extrabold text-[#4A3525]">
                  🍪 如何在 LINE 群組與 IG 小盒子共同記帳？
                </h3>
                <ul className="text-xs text-[#6E5233] space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>
                    將下方連結貼到 <strong>LINE 群組記事本/聊天室</strong> 或 <strong>IG 群組聊天室</strong>。
                  </li>
                  <li>
                    親友點開只會看到<strong>這一個分帳群組</strong>（不會看到妳的其他私人帳本），<strong>免下載 App、免註冊</strong>即可共同記帳！
                  </li>
                  <li>
                    已內建<strong>永久雲端雙向同步</strong>，無論在手機主畫面、Safari 或 LINE 內新增修改，所有人都會即時同步更新！
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E5643] mb-1.5">
                  群組專屬分享連結
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3.5 py-2.5 text-xs font-mono cream-input"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 btn-quokka"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? '已複製' : '複製連結'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLineShare}
                className="w-full py-3 px-4 rounded-2xl bg-[#06C755] hover:bg-[#05B34C] text-white border-2 border-[#3E2C1E] shadow-[0_3px_0_#3E2C1E] active:translate-y-[1px] active:shadow-[0_1px_0_#3E2C1E] font-extrabold text-sm transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                直接轉發連結 / Flex 卡片給 LINE 好友
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
