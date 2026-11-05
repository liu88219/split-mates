import { describe, expect, it } from 'vitest';
import {
  calculateGroupBalances,
  computeSplitAmounts,
  simplifyDebts,
} from './settlement';
import { BillGroup } from '../types/bill';

describe('SplitMates Settlement & Split Engine', () => {
  it('computes equal split with exact penny remainder handling', () => {
    const res = computeSplitAmounts(100, 'equal', [
      { memberId: 'm1', value: 1 },
      { memberId: 'm2', value: 1 },
      { memberId: 'm3', value: 1 },
    ]);
    expect(res).toHaveLength(3);
    expect(res[0].calculatedAmount).toBe(33.33);
    expect(res[1].calculatedAmount).toBe(33.33);
    expect(res[2].calculatedAmount).toBe(33.34);
    const sum = res.reduce((acc, item) => acc + item.calculatedAmount, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('computes ratio/shares split accurately', () => {
    const res = computeSplitAmounts(1500, 'shares', [
      { memberId: 'm1', value: 2 },
      { memberId: 'm2', value: 1 },
      { memberId: 'm3', value: 0 },
    ]);
    expect(res[0].calculatedAmount).toBe(1000);
    expect(res[1].calculatedAmount).toBe(500);
    expect(res[2].calculatedAmount).toBe(0);
  });

  it('supports excluding payer from split so only checked members share the cost', () => {
    // Mona (m1) pays 1000, but only Alice (m2) and Bob (m3) are checked to split it
    const splits = computeSplitAmounts(1000, 'equal', [
      { memberId: 'm1', value: 0 }, // Payer excluded
      { memberId: 'm2', value: 1 }, // Checked
      { memberId: 'm3', value: 1 }, // Checked
      { memberId: 'm4', value: 0 }, // Unchecked
    ]);
    expect(splits[0].calculatedAmount).toBe(0);
    expect(splits[1].calculatedAmount).toBe(500);
    expect(splits[2].calculatedAmount).toBe(500);
    expect(splits[3].calculatedAmount).toBe(0);
  });

  it('simplifies multi-person debts into minimum number of transfers', () => {
    const mockGroup: BillGroup = {
      id: 'g1',
      name: 'Test Group',
      coverEmoji: '✈️',
      baseCurrency: 'TWD',
      customRates: {},
      members: [
        { id: 'A', name: 'Mona', avatarColor: 'bg-indigo-500' },
        { id: 'B', name: 'Alice', avatarColor: 'bg-rose-500' },
        { id: 'C', name: 'Bob', avatarColor: 'bg-emerald-500' },
      ],
      expenses: [
        {
          id: 'e1',
          title: 'Dinner',
          category: 'food',
          date: '2026-11-01',
          currency: 'TWD',
          exchangeRateToBase: 1,
          originalAmount: 900,
          baseAmount: 900,
          paidBy: [{ memberId: 'A', amount: 900 }],
          splitMode: 'equal',
          splits: [
            { memberId: 'A', value: 1, calculatedAmount: 300 },
            { memberId: 'B', value: 1, calculatedAmount: 300 },
            { memberId: 'C', value: 1, calculatedAmount: 300 },
          ],
          createdAt: 1,
        },
        {
          id: 'e2',
          title: 'Taxi',
          category: 'transport',
          date: '2026-11-01',
          currency: 'TWD',
          exchangeRateToBase: 1,
          originalAmount: 300,
          baseAmount: 300,
          paidBy: [{ memberId: 'B', amount: 300 }],
          splitMode: 'equal',
          splits: [
            { memberId: 'A', value: 0, calculatedAmount: 0 },
            { memberId: 'B', value: 0, calculatedAmount: 0 },
            { memberId: 'C', value: 1, calculatedAmount: 300 },
          ],
          createdAt: 2,
        },
      ],
      settledRecords: [],
      updatedAt: 1,
    };

    // Mona paid 900, owed 300 -> net +600
    // Alice paid 300, owed 300 -> net 0
    // Bob paid 0, owed 600 -> net -600
    // Instead of Bob->Alice 300 and Alice->Mona 300 (2 transfers),
    // simplified transfer is just 1 transfer: Bob -> Mona 600!
    const balances = calculateGroupBalances(mockGroup);
    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toEqual({
      fromMemberId: 'C',
      fromMemberName: 'Bob',
      toMemberId: 'A',
      toMemberName: 'Mona',
      amount: 600,
    });
  });
});
