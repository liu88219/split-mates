import { BillGroup, MemberBalance, SimplifiedTransfer } from '../types/bill';
import { formatMoney } from './currencies';

/**
 * 使用 HTML5 Canvas 繪製高解析度 (Retina 2x) 的「Quokka & BOBO 簡約奶油風 IG / LINE 結算圖片小卡」
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
    paymentMembers.length > 0 ? 84 + paymentMembers.length * 46 : 0;

  const transfersHeight = Math.max(1, transfers.length) * transferRowHeight + 84;
  const membersHeight = balances.length * memberRowHeight + 84;
  const height = 356 + transfersHeight + membersHeight + paymentSectionHeight + 112;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Helper for rounded rectangle
  const drawRoundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke?: string,
    lineW = 2.5
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
      ctx.lineWidth = lineW;
      ctx.stroke();
    }
  };

  // 1. Warm Creamy Oatmeal Canvas Background
  ctx.fillStyle = '#FAF5EB';
  ctx.fillRect(0, 0, width, height);

  // Subtle polka-dot stationery pattern
  ctx.fillStyle = 'rgba(189, 123, 77, 0.08)';
  for (let py = 28; py < height; py += 36) {
    for (let px = 28; px < width; px += 36) {
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stitched inner stationery border
  ctx.save();
  ctx.strokeStyle = '#E5D4BE';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(24, 24, width - 48, height - 48);
  ctx.restore();

  // Draw Cute Minimalist Quokka & BOBO Duo in Top-Right Header!
  const drawCuteMascots = (ox: number, oy: number) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // BOBO (White Marshmallow Bear on right)
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#3E2C1E';
    ctx.lineWidth = 4.5;
    // Ears
    ctx.beginPath();
    ctx.arc(92, 26, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(136, 26, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Head
    drawRoundRect(82, 24, 64, 68, 30, '#FFFDF9', '#3E2C1E', 4.5);
    // Eyes & Nose
    ctx.fillStyle = '#3E2C1E';
    ctx.beginPath();
    ctx.arc(104, 53, 3.3, 0, Math.PI * 2);
    ctx.arc(124, 53, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F7B7A9';
    ctx.beginPath();
    ctx.ellipse(95, 60, 6, 3.8, 0, 0, Math.PI * 2);
    ctx.ellipse(133, 60, 6, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3E2C1E';
    ctx.beginPath();
    ctx.ellipse(114, 58, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // QUOKKA (Caramel Marsupial on left)
    ctx.fillStyle = '#BD7B4D';
    ctx.strokeStyle = '#3E2C1E';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(24, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(72, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawRoundRect(12, 16, 72, 78, 34, '#BD7B4D', '#3E2C1E', 4.5);
    // Eyes
    ctx.fillStyle = '#3E2C1E';
    ctx.beginPath();
    ctx.arc(37, 48, 3.6, 0, Math.PI * 2);
    ctx.arc(59, 48, 3.6, 0, Math.PI * 2);
    ctx.fill();
    // Blush
    ctx.fillStyle = '#EB8B78';
    ctx.beginPath();
    ctx.ellipse(26, 56, 7, 4.2, 0, 0, Math.PI * 2);
    ctx.ellipse(70, 56, 7, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nose & Smile
    ctx.fillStyle = '#3E2C1E';
    ctx.beginPath();
    ctx.ellipse(48, 53, 5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E56F5E';
    ctx.beginPath();
    ctx.moveTo(37, 61);
    ctx.quadraticCurveTo(48, 75, 59, 61);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  drawCuteMascots(width - 216, 48);

  // 2. Header Title
  const totalSpend = group.expenses.reduce((s, e) => s + e.baseAmount, 0);
  drawRoundRect(56, 48, 286, 38, 19, '#FCE394', '#3E2C1E', 2.5);
  ctx.fillStyle = '#4A3525';
  ctx.font = 'bold 20px "Quicksand", "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText('🍪 SPLITMATES 奶油分帳結算單', 74, 74);

  ctx.fillStyle = '#3E2C1E';
  ctx.font = 'bold 44px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText(`${group.coverEmoji} ${group.name}`, 56, 138);

  // Summary Butter Cream Box
  drawRoundRect(
    56,
    170,
    width - 112,
    132,
    28,
    '#FFFDF9',
    '#3E2C1E',
    3
  );

  ctx.fillStyle = '#8C705A';
  ctx.font = 'bold 22px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText('群組累計總花費', 90, 216);
  ctx.fillText('參與好友 / 帳目筆數', 520, 216);

  ctx.fillStyle = '#B06D3E';
  ctx.font = 'bold 42px "Quicksand", "Noto Sans TC", sans-serif';
  ctx.fillText(formatMoney(Math.round(totalSpend), group.baseCurrency), 90, 272);

  ctx.fillStyle = '#4A3525';
  ctx.font = 'bold 33px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText(`${group.members.length} 人 · ${group.expenses.length} 筆消費`, 520, 270);

  let cursorY = 334;

  // 3. Minimum Transfers Section
  drawRoundRect(
    56,
    cursorY,
    width - 112,
    transfersHeight,
    28,
    '#FFFDF9',
    '#E5D3BD',
    3
  );

  ctx.fillStyle = '#3E2C1E';
  ctx.font = 'bold 27px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText('⚡ 最少轉帳結算建議 (誰該轉給誰)', 88, cursorY + 52);

  let transferY = cursorY + 86;
  if (transfers.length === 0) {
    drawRoundRect(84, transferY - 6, width - 168, 62, 18, '#EBF4EC', '#C5DEC8', 2);
    ctx.fillStyle = '#487353';
    ctx.font = 'bold 25px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
    ctx.fillText('🎉 太棒了！目前所有帳目皆已結清，互不相欠！', 106, transferY + 34);
  } else {
    transfers.forEach((t, idx) => {
      drawRoundRect(
        84,
        transferY,
        width - 168,
        62,
        18,
        idx % 2 === 0 ? '#FAF3E8' : '#FFF9EE',
        '#EADBC8',
        2
      );

      ctx.fillStyle = '#3E2C1E';
      ctx.font = 'bold 25px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
      ctx.fillText(`${t.fromMemberName}`, 108, transferY + 40);

      ctx.fillStyle = '#B06D3E';
      ctx.font = 'bold 22px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
      ctx.fillText('➜ 轉給 ➜', 284, transferY + 39);

      ctx.fillStyle = '#3E2C1E';
      ctx.font = 'bold 25px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
      ctx.fillText(`${t.toMemberName}`, 424, transferY + 40);

      const amtText = formatMoney(t.amount, group.baseCurrency);
      ctx.fillStyle = '#C95B49';
      ctx.font = 'bold 28px "Quicksand", "Noto Sans TC", sans-serif';
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
    28,
    '#F5EDE0',
    '#E4D3BE',
    2.5
  );

  ctx.fillStyle = '#4A3525';
  ctx.font = 'bold 26px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText('📊 每人消費與先墊統計', 88, cursorY + 50);

  let memY = cursorY + 84;
  balances.forEach((b) => {
    ctx.fillStyle = '#3E2C1E';
    ctx.font = 'bold 24px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
    ctx.fillText(b.memberName, 88, memY + 34);

    ctx.fillStyle = '#826752';
    ctx.font = '600 20px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
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
      b.netBalance > 0 ? '#4B7A57' : b.netBalance < 0 ? '#C95B49' : '#8C705A';
    ctx.font = 'bold 22px "Quicksand", "Noto Sans TC", sans-serif';
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
      24,
      '#FFF8E3',
      '#EBD494',
      2.5
    );
    ctx.fillStyle = '#7A531E';
    ctx.font = 'bold 23px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
    ctx.fillText('🏦 收款帳號與轉帳方式', 88, cursorY + 46);

    let payY = cursorY + 84;
    paymentMembers.forEach((m) => {
      ctx.fillStyle = '#4A3525';
      ctx.font = '600 21px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
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
  ctx.fillStyle = '#967B65';
  ctx.font = '600 20px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText(
    `🍪 SplitMates 奶油分帳本 · Quokka & BOBO 陪你開心出遊分帳 · ${nowStr}`,
    56,
    height - 42
  );

  return canvas.toDataURL('image/png');
}
