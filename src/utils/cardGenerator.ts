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
    drawRoundRect(0, 4, 168, 100, 28, '#F7CE6A');
    // Subtle golden floor strip
    drawRoundRect(8, 86, 152, 12, 6, '#DFAE44');

    // QUOKKA (Left: V3 99% Gold-Standard bare caramel fur + touching crown ears + mouthless chunky nose + angled stick feet)
    ctx.fillStyle = '#C99661';
    ctx.beginPath();
    ctx.arc(40, 25, 10, 0, Math.PI * 2);
    ctx.arc(56, 25, 10, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(24, 26, 48, 69, 21, '#C99661');
    // Tiny black mitten paws holding mini cream receipt
    drawRoundRect(41, 63, 14, 17, 3, '#FAF8F3');
    ctx.fillStyle = '#171210';
    ctx.beginPath();
    ctx.arc(39.5, 70, 3.2, 0, Math.PI * 2);
    ctx.arc(56.5, 70, 3.2, 0, Math.PI * 2);
    // Angled flat black stick-oval soles (\  /)
    ctx.ellipse(32, 91, 3.2, 8.5, -0.35, 0, Math.PI * 2);
    ctx.ellipse(64, 91, 3.2, 8.5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Quokka Face: close-set tiny dot eyes + chunky round-oval black blob nose (ZERO mouth!)
    ctx.fillStyle = '#171210';
    ctx.beginPath();
    ctx.arc(43, 41, 2.3, 0, Math.PI * 2);
    ctx.arc(53, 41, 2.3, 0, Math.PI * 2);
    ctx.ellipse(48, 50.5, 5.4, 6.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mini Stacked Marshmallows in middle
    drawRoundRect(81, 82, 13, 12, 4, '#FFFFFF');
    drawRoundRect(82, 70, 12, 11.5, 4, '#FFFFFF');
    ctx.fillStyle = '#3B322B';
    ctx.beginPath();
    ctx.arc(86, 75, 1, 0, Math.PI * 2);
    ctx.arc(90, 75, 1, 0, Math.PI * 2);
    ctx.arc(85.5, 87, 1, 0, Math.PI * 2);
    ctx.arc(89.5, 87, 1, 0, Math.PI * 2);
    ctx.fill();

    // Brown Wooden Stool + Snow-White Cloud BOBO with connected upturned ω smile
    drawRoundRect(104, 79, 44, 5.5, 2.5, '#785634');
    drawRoundRect(109, 83, 5.5, 13, 2, '#785634');
    drawRoundRect(137, 83, 5.5, 13, 2, '#785634');
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(114, 38, 7.5, 0, Math.PI * 2);
    ctx.arc(138, 38, 7.5, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(104, 37, 44, 43, 19, '#FFFFFF');
    ctx.fillStyle = '#171210';
    ctx.beginPath();
    ctx.arc(121.5, 51, 2.1, 0, Math.PI * 2);
    ctx.arc(130.5, 51, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#171210';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(126, 54.8);
    ctx.lineTo(126, 58.2);
    ctx.moveTo(120.5, 58.2);
    ctx.quadraticCurveTo(123.2, 61.8, 126, 58);
    ctx.quadraticCurveTo(128.8, 61.8, 131.5, 58.2);
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
