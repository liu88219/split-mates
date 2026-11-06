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

  // 1. Authentic Dinotaeng Warm Oatmeal-Cream Matte Paper Canvas
  ctx.fillStyle = '#ECE8DF';
  ctx.fillRect(0, 0, width, height);

  // Soft Matte Cream Stationery Frame
  drawRoundRect(24, 24, width - 48, height - 48, 36, '#FAF8F3', '#DDD7C9', 2);

  // Draw Authentic Lineless Dinotaeng Quokka & Snow-White BOBO Duo in Top-Right Header!
  const drawCuteMascots = (ox: number, oy: number) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Warm Butter-Yellow Dinotaeng Stage Pill so snow-white lineless BOBO pops cleanly
    drawRoundRect(0, 4, 162, 100, 28, '#F2CA62');

    // QUOKKA (Left: solid caramel fur + denim overalls, NO dark outline, NO blush)
    ctx.fillStyle = '#C48E63';
    ctx.beginPath();
    ctx.arc(34, 28, 10, 0, Math.PI * 2);
    ctx.arc(62, 28, 10, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(22, 24, 52, 50, 23, '#C48E63');
    drawRoundRect(24, 64, 48, 32, 16, '#C48E63');
    // Denim Overalls (#2C4268)
    drawRoundRect(25, 72, 46, 23, 8, '#2C4268');
    drawRoundRect(33, 63, 7, 13, 3, '#2C4268');
    drawRoundRect(56, 63, 7, 13, 3, '#2C4268');
    // Black Feet
    ctx.fillStyle = '#14110F';
    ctx.beginPath();
    ctx.ellipse(36, 97, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(60, 97, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Quokka Face: close-set eyes + vertical black bean nose + happy open mouth with coral tongue
    ctx.fillStyle = '#14110F';
    ctx.beginPath();
    ctx.ellipse(42, 41, 2.3, 2.9, 0, 0, Math.PI * 2);
    ctx.ellipse(54, 41, 2.3, 2.9, 0, 0, Math.PI * 2);
    ctx.ellipse(48, 49, 4, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(48, 57, 5.2, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#E37A70';
    ctx.beginPath();
    ctx.ellipse(48, 60.2, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // BOBO (Right: pure snow-white gummy bear, NO dark outline, NO blush)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(103, 43, 7.5, 0, Math.PI * 2);
    ctx.arc(131, 43, 7.5, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(94, 42, 46, 36, 18, '#FFFFFF');
    drawRoundRect(93, 66, 48, 31, 16, '#FFFFFF');
    // BOBO Face: close-set dot eyes + tiny nose + w mouth
    ctx.fillStyle = '#14110F';
    ctx.beginPath();
    ctx.ellipse(112, 56, 1.9, 2.3, 0, 0, Math.PI * 2);
    ctx.ellipse(122, 56, 1.9, 2.3, 0, 0, Math.PI * 2);
    ctx.ellipse(117, 61, 2.3, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14110F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(112, 64);
    ctx.quadraticCurveTo(114.5, 67.5, 117, 64.2);
    ctx.quadraticCurveTo(119.5, 67.5, 122, 64);
    ctx.stroke();

    ctx.restore();
  };

  drawCuteMascots(width - 218, 48);

  // 2. Header Title
  const totalSpend = group.expenses.reduce((s, e) => s + e.baseAmount, 0);
  drawRoundRect(56, 52, 296, 38, 19, '#F2CA62');
  ctx.fillStyle = '#2D251E';
  ctx.font = 'bold 20px "Quicksand", "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText('🧈 SPLITMATES 奶油分帳結算單', 74, 77);

  ctx.fillStyle = '#2D251E';
  ctx.font = 'bold 44px "Zen Maru Gothic", "Noto Sans TC", sans-serif';
  ctx.fillText(`${group.coverEmoji} ${group.name}`, 56, 140);

  // Summary Matte Oatmeal Box
  drawRoundRect(
    56,
    170,
    width - 112,
    132,
    28,
    '#EFECE4',
    '#DDD7C9',
    2
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
