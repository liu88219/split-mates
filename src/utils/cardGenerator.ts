import { BillGroup, MemberBalance, SimplifiedTransfer } from '../types/bill';
import { formatMoney } from './currencies';

/**
 * 使用 HTML5 Canvas 繪製高解析度 (Retina 2x) 的「IG / LINE 結算圖片小卡」
 * 回傳 DataURL (image/png) 供預覽、下載或透過 Web Share API 直接傳送到 IG / LINE
 */
export function renderSettlementCardToDataUrl(
  group: BillGroup,
  balances: MemberBalance[],
  transfers: SimplifiedTransfer[]
): string {
  const width = 900;
  const transferRowHeight = 76;
  const memberRowHeight = 62;
  const paymentMembers = group.members.filter((m) => m.paymentInfo && m.paymentInfo.trim());
  const paymentSectionHeight =
    paymentMembers.length > 0 ? 80 + paymentMembers.length * 46 : 0;

  const transfersHeight = Math.max(1, transfers.length) * transferRowHeight + 80;
  const membersHeight = balances.length * memberRowHeight + 80;
  const height = 340 + transfersHeight + membersHeight + paymentSectionHeight + 110;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.4, '#1e1b4b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative glow circles
  ctx.save();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
  ctx.beginPath();
  ctx.arc(width - 100, 110, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
  ctx.beginPath();
  ctx.arc(100, height - 140, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Helper for rounded rectangle
  const drawRoundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke?: string
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // 2. Header Banner
  const totalSpend = group.expenses.reduce((s, e) => s + e.baseAmount, 0);
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '600 24px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText('SPLITMATES 好友多人分帳結算單', 56, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText(`${group.coverEmoji} ${group.name}`, 56, 132);

  // Summary Pill Box
  drawRoundRect(
    56,
    166,
    width - 112,
    126,
    24,
    'rgba(255, 255, 255, 0.08)',
    'rgba(255, 255, 255, 0.16)'
  );

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 22px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText('群組累計總花費', 90, 212);
  ctx.fillText('參與人數 / 帳目筆數', 520, 212);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 42px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText(formatMoney(Math.round(totalSpend), group.baseCurrency), 90, 265);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText(`${group.members.length} 人 · ${group.expenses.length} 筆消費`, 520, 263);

  let cursorY = 330;

  // 3. Minimum Transfers Section
  drawRoundRect(
    56,
    cursorY,
    width - 112,
    transfersHeight,
    24,
    'rgba(255, 255, 255, 0.96)'
  );

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 28px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText('⚡ 最少轉帳結算建議 (誰該轉給誰)', 88, cursorY + 52);

  let transferY = cursorY + 86;
  if (transfers.length === 0) {
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 26px "Inter", "Noto Sans TC", sans-serif';
    ctx.fillText('🎉 太棒了！目前所有帳目皆已結清，互不相欠！', 88, transferY + 34);
  } else {
    transfers.forEach((t, idx) => {
      drawRoundRect(
        84,
        transferY,
        width - 168,
        62,
        16,
        idx % 2 === 0 ? '#f1f5f9' : '#f8fafc',
        '#e2e8f0'
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 25px "Inter", "Noto Sans TC", sans-serif';
      ctx.fillText(`${t.fromMemberName}`, 108, transferY + 40);

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 22px "Inter", "Noto Sans TC", sans-serif';
      ctx.fillText(`➜ 轉給 ➜`, 280, transferY + 39);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 25px "Inter", "Noto Sans TC", sans-serif';
      ctx.fillText(`${t.toMemberName}`, 420, transferY + 40);

      const amtText = formatMoney(t.amount, group.baseCurrency);
      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 28px "Inter", "Noto Sans TC", sans-serif';
      const amtWidth = ctx.measureText(amtText).width;
      ctx.fillText(amtText, width - 112 - amtWidth, transferY + 41);

      transferY += transferRowHeight;
    });
  }

  cursorY += transfersHeight + 28;

  // 4. Member Balances Section
  drawRoundRect(
    56,
    cursorY,
    width - 112,
    membersHeight,
    24,
    'rgba(255, 255, 255, 0.08)',
    'rgba(255, 255, 255, 0.14)'
  );

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 26px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText('📊 每人消費與先墊統計', 88, cursorY + 50);

  let memY = cursorY + 84;
  balances.forEach((b) => {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Inter", "Noto Sans TC", sans-serif';
    ctx.fillText(b.memberName, 88, memY + 34);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 20px "Inter", "Noto Sans TC", sans-serif';
    ctx.fillText(
      `應分攤 ${formatMoney(Math.round(b.totalOwed), group.baseCurrency)} ｜ 已先墊 ${formatMoney(
        Math.round(b.totalPaid),
        group.baseCurrency
      )}`,
      245,
      memY + 33
    );

    const netStr =
      b.netBalance > 0
        ? `應收 +${formatMoney(Math.round(b.netBalance), group.baseCurrency)}`
        : b.netBalance < 0
        ? `應付 -${formatMoney(Math.round(Math.abs(b.netBalance)), group.baseCurrency)}`
        : '已結清';

    ctx.fillStyle =
      b.netBalance > 0 ? '#34d399' : b.netBalance < 0 ? '#fb7185' : '#cbd5e1';
    ctx.font = 'bold 22px "Inter", "Noto Sans TC", sans-serif';
    const netW = ctx.measureText(netStr).width;
    ctx.fillText(netStr, width - 92 - netW, memY + 34);

    memY += memberRowHeight;
  });

  cursorY += membersHeight + 24;

  // 5. Payment Info Section (if any)
  if (paymentMembers.length > 0) {
    drawRoundRect(
      56,
      cursorY,
      width - 112,
      paymentSectionHeight,
      20,
      'rgba(16, 185, 129, 0.12)',
      'rgba(16, 185, 129, 0.3)'
    );
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 23px "Inter", "Noto Sans TC", sans-serif';
    ctx.fillText('🏦 收款帳號與轉帳方式', 88, cursorY + 44);

    let payY = cursorY + 82;
    paymentMembers.forEach((m) => {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '500 21px "Inter", "Noto Sans TC", sans-serif';
      ctx.fillText(`• ${m.name}：${m.paymentInfo}`, 88, payY);
      payY += 42;
    });
    cursorY += paymentSectionHeight + 20;
  }

  // 6. Footer
  const nowStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 20px "Inter", "Noto Sans TC", sans-serif';
  ctx.fillText(
    `由 SplitMates 分帳好夥伴自動產生 · 支援 LINE & IG 即時分帳 · ${nowStr}`,
    56,
    height - 36
  );

  return canvas.toDataURL('image/png');
}
