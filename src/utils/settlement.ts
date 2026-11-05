import {
  BillGroup,
  MemberBalance,
  SimplifiedTransfer,
  SplitItem,
  SplitMode,
} from '../types/bill';
import { formatMoney } from './currencies';

/**
 * 根據分攤模式 (equal / exact / shares / percent) 計算每位成員應分攤之原幣別金額
 */
export function computeSplitAmounts(
  totalAmount: number,
  mode: SplitMode,
  items: { memberId: string; value: number }[]
): SplitItem[] {
  const safeTotal = Math.max(0, Number(totalAmount) || 0);

  if (mode === 'equal') {
    const active = items.filter((i) => i.value > 0);
    const count = active.length;
    if (count === 0) {
      return items.map((i) => ({ ...i, calculatedAmount: 0 }));
    }
    const baseShare = Math.floor((safeTotal / count) * 100) / 100;
    let distributed = 0;
    let activeIdx = 0;

    return items.map((item) => {
      if (item.value <= 0) {
        return { memberId: item.memberId, value: 0, calculatedAmount: 0 };
      }
      activeIdx++;
      if (activeIdx === count) {
        const remainder = Number((safeTotal - distributed).toFixed(2));
        return { memberId: item.memberId, value: 1, calculatedAmount: remainder };
      }
      distributed = Number((distributed + baseShare).toFixed(2));
      return { memberId: item.memberId, value: 1, calculatedAmount: baseShare };
    });
  }

  if (mode === 'exact') {
    return items.map((item) => {
      const amt = Math.max(0, Number(item.value) || 0);
      return {
        memberId: item.memberId,
        value: amt,
        calculatedAmount: Number(amt.toFixed(2)),
      };
    });
  }

  if (mode === 'shares') {
    const totalShares = items.reduce((sum, i) => sum + Math.max(0, Number(i.value) || 0), 0);
    if (totalShares <= 0) {
      return items.map((i) => ({ memberId: i.memberId, value: 0, calculatedAmount: 0 }));
    }
    let distributed = 0;
    const activeIndices = items
      .map((item, idx) => (item.value > 0 ? idx : -1))
      .filter((idx) => idx !== -1);
    const lastActiveIdx = activeIndices[activeIndices.length - 1] ?? -1;

    return items.map((item, idx) => {
      const share = Math.max(0, Number(item.value) || 0);
      if (share <= 0) {
        return { memberId: item.memberId, value: 0, calculatedAmount: 0 };
      }
      if (idx === lastActiveIdx) {
        const remainder = Number((safeTotal - distributed).toFixed(2));
        return { memberId: item.memberId, value: share, calculatedAmount: remainder };
      }
      const calc = Number(((safeTotal * share) / totalShares).toFixed(2));
      distributed = Number((distributed + calc).toFixed(2));
      return { memberId: item.memberId, value: share, calculatedAmount: calc };
    });
  }

  // mode === 'percent'
  return items.map((item) => {
    const pct = Math.max(0, Number(item.value) || 0);
    const calc = Number(((safeTotal * pct) / 100).toFixed(2));
    return {
      memberId: item.memberId,
      value: pct,
      calculatedAmount: calc,
    };
  });
}

/**
 * 計算群組內每位成員的累積應付、先墊付、已結清與淨額（以群組 baseCurrency 計價）
 */
export function calculateGroupBalances(group: BillGroup): MemberBalance[] {
  const map = new Map<string, MemberBalance>();

  group.members.forEach((m) => {
    map.set(m.id, {
      memberId: m.id,
      memberName: m.name,
      totalOwed: 0,
      totalPaid: 0,
      settledAdjustment: 0,
      netBalance: 0,
    });
  });

  group.expenses.forEach((exp) => {
    const rate = exp.exchangeRateToBase || 1;

    // 1. 墊付人 (PaidBy)
    exp.paidBy.forEach((payer) => {
      const entry = map.get(payer.memberId);
      if (entry) {
        entry.totalPaid += (Number(payer.amount) || 0) * rate;
      }
    });

    // 2. 分攤人 (Splits)
    exp.splits.forEach((split) => {
      const entry = map.get(split.memberId);
      if (entry) {
        entry.totalOwed += (Number(split.calculatedAmount) || 0) * rate;
      }
    });
  });

  // 3. 已結清紀錄 (SettledRecords)
  // 若 A (應付者) 已經轉帳給 B (應收者) amount 元：
  // A 付出了錢 -> A 的 netBalance 應增加 amount (負債減少)
  // B 收到了錢 -> B 的 netBalance 應減少 amount (應收減少)
  (group.settledRecords || []).forEach((rec) => {
    const fromEntry = map.get(rec.fromMemberId);
    const toEntry = map.get(rec.toMemberId);
    const amt = Number(rec.amount) || 0;
    if (fromEntry) {
      fromEntry.settledAdjustment += amt;
    }
    if (toEntry) {
      toEntry.settledAdjustment -= amt;
    }
  });

  const result: MemberBalance[] = [];
  map.forEach((b) => {
    const net = b.totalPaid - b.totalOwed + b.settledAdjustment;
    result.push({
      ...b,
      totalOwed: Number(b.totalOwed.toFixed(2)),
      totalPaid: Number(b.totalPaid.toFixed(2)),
      settledAdjustment: Number(b.settledAdjustment.toFixed(2)),
      netBalance: Math.abs(net) < 0.05 ? 0 : Number(net.toFixed(2)),
    });
  });

  return result;
}

/**
 * 最少轉帳次數演算法 (Greedy Min-Cash-Flow Debt Simplification)
 * 將複雜的多人交叉墊付化簡為最少筆數的轉帳清單
 */
export function simplifyDebts(balances: MemberBalance[]): SimplifiedTransfer[] {
  const creditors = balances
    .filter((b) => b.netBalance > 0.5)
    .map((b) => ({ ...b, remaining: b.netBalance }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter((b) => b.netBalance < -0.5)
    .map((b) => ({ ...b, remaining: Math.abs(b.netBalance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: SimplifiedTransfer[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const transferAmount = Math.min(debtor.remaining, creditor.remaining);
    const roundedAmount = Math.round(transferAmount);

    if (roundedAmount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.memberName,
        toMemberId: creditor.memberId,
        toMemberName: creditor.memberName,
        amount: roundedAmount,
      });
    }

    debtor.remaining -= transferAmount;
    creditor.remaining -= transferAmount;

    if (debtor.remaining < 0.5) i++;
    if (creditor.remaining < 0.5) j++;

    // Re-sort remaining slices if multiple creditors/debtors remain to keep optimal greedy pairing
    if (i < debtors.length - 1) {
      const restDebtors = debtors.slice(i).sort((a, b) => b.remaining - a.remaining);
      debtors.splice(i, restDebtors.length, ...restDebtors);
    }
    if (j < creditors.length - 1) {
      const restCreditors = creditors.slice(j).sort((a, b) => b.remaining - a.remaining);
      creditors.splice(j, restCreditors.length, ...restCreditors);
    }
  }

  return transfers;
}

/**
 * 產生適合直接貼到 LINE 群組或 IG 小盒子 (DM) 的排版結算文字
 */
export function generateLineIgSummaryText(
  group: BillGroup,
  balances: MemberBalance[],
  transfers: SimplifiedTransfer[],
  shareUrl: string
): string {
  const totalSpend = group.expenses.reduce((sum, e) => sum + e.baseAmount, 0);
  const lines: string[] = [];

  lines.push(`${group.coverEmoji} 【${group.name}】分帳結算單`);
  lines.push(`━━━━━━━━━━━━━━━`);
  lines.push(`💰 總花費：${formatMoney(Math.round(totalSpend), group.baseCurrency)}（共 ${group.expenses.length} 筆）`);
  lines.push(`👥 參與成員：${group.members.map((m) => m.name).join('、')}`);
  lines.push('');

  if (transfers.length === 0) {
    lines.push(`🎉 所有帳目皆已結清！大家互不相欠～`);
  } else {
    lines.push(`⚡ 【最少轉帳結算建議】（共 ${transfers.length} 筆）`);
    transfers.forEach((t, idx) => {
      const receiver = group.members.find((m) => m.id === t.toMemberId);
      const paymentHint = receiver?.paymentInfo ? ` (${receiver.paymentInfo})` : '';
      lines.push(
        `${idx + 1}. 💸 ${t.fromMemberName} ➜ 給 ${t.toMemberName}：${formatMoney(
          t.amount,
          group.baseCurrency
        )}${paymentHint}`
      );
    });
  }

  lines.push('');
  lines.push(`📊 【個人消費與墊付統計】`);
  balances.forEach((b) => {
    const netTag =
      b.netBalance > 0
        ? `🟢 應收 ${formatMoney(Math.round(b.netBalance), group.baseCurrency)}`
        : b.netBalance < 0
        ? `🔴 應付 ${formatMoney(Math.round(Math.abs(b.netBalance)), group.baseCurrency)}`
        : `⚪ 已結清`;
    lines.push(
      `• ${b.memberName}：應攤 ${formatMoney(
        Math.round(b.totalOwed),
        group.baseCurrency
      )}｜先墊 ${formatMoney(Math.round(b.totalPaid), group.baseCurrency)}（${netTag}）`
    );
  });

  const membersWithPayment = group.members.filter((m) => m.paymentInfo && m.paymentInfo.trim());
  if (membersWithPayment.length > 0) {
    lines.push('');
    lines.push(`🏦 【收款帳號資訊】`);
    membersWithPayment.forEach((m) => {
      lines.push(`• ${m.name}：${m.paymentInfo}`);
    });
  }

  if (shareUrl) {
    lines.push('');
    lines.push(`🔗 點開連結查看明細 / 共同記帳：`);
    lines.push(shareUrl);
  }

  return lines.join('\n');
}
