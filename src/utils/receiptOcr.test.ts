import { describe, expect, it } from 'vitest';
import { parseReceiptTextToItems } from './receiptOcr';
import {
  buildShareableGroupUrl,
  parseImportedGroupsJson,
} from '../services/cloudSync';
import { createKaohsiungGroup } from './demoData';

describe('parseReceiptTextToItems', () => {
  it('parses Taiwan restaurant POS single-line receipt + 10% service fee and filters noise lines', () => {
    const raw = `
      築間幸福鍋物
      2026-11-05 19:24
      桌號: A3  單號: 0042
      頂級牛小排鍋 x1   NT$680
      松阪豬肉鍋 *2     1,160
      鮮蝦漿            120
      10% 服務費        196
      小計              1,960
      總計              2,156
      現金              2,500
      找零              344
      統編: 12345678
    `;

    const res = parseReceiptTextToItems(raw);
    expect(res.currency).toBe('TWD');
    expect(res.serviceFeePercent).toBe(10);
    expect(res.items).toEqual([
      { name: '頂級牛小排鍋', quantity: 1, amount: 680 },
      { name: '松阪豬肉鍋', quantity: 2, amount: 1160 },
      { name: '鮮蝦漿', quantity: 1, amount: 120 },
    ]);
  });

  it('parses Taiwan 2-line electronic invoice detail (品名 + 單價TX * 數量 小計TX)', () => {
    const raw = `
      電子發票證明聯
      AB-12345678
      大杯珍珠奶茶
      65TX * 2 130TX
      四季春青茶
      40TX * 1 40TX
      合計 170
    `;

    const res = parseReceiptTextToItems(raw);
    expect(res.currency).toBe('TWD');
    expect(res.items).toEqual([
      { name: '大杯珍珠奶茶', quantity: 2, amount: 130 },
      { name: '四季春青茶', quantity: 1, amount: 40 },
    ]);
  });

  it('parses Japanese JPY receipt with ¥ and 円 symbols', () => {
    const raw = `
      鳥貴族 新宿店
      もも貴族焼 x2  ¥740
      生ビール       370円
      唐揚げ         ¥370
      合計           ¥1,480
    `;

    const res = parseReceiptTextToItems(raw);
    expect(res.currency).toBe('JPY');
    expect(res.items).toEqual([
      { name: 'もも貴族焼', quantity: 2, amount: 740 },
      { name: '生ビール', quantity: 1, amount: 370 },
      { name: '唐揚げ', quantity: 1, amount: 370 },
    ]);
  });
});

describe('parseImportedGroupsJson backup restore', () => {
  it('parses exported SplitMates JSON backup payload cleanly', () => {
    const g = createKaohsiungGroup();
    const json = JSON.stringify({
      app: 'SplitMates',
      version: 1,
      exportedAt: '2026-11-06T00:00:00Z',
      groups: [g],
    });
    const parsed = parseImportedGroupsJson(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(g.id);
    expect(parsed[0].name).toBe(g.name);
    expect(parsed[0].syncKey).toBeTruthy();
  });

  it('builds a clean, short shareable URL safe for LINE & IG without truncation', () => {
    // Provide window stub for Node vitest environment
    const origWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {
      location: {
        origin: 'https://liu88219.github.io',
        pathname: '/split-mates/',
      },
    };
    try {
      const g = createKaohsiungGroup();
      const url = buildShareableGroupUrl(g);
      expect(url).toContain('group=kaohsiung-trip');
      expect(url).toContain('mode=shared');
      expect(url).toContain('k=');
      expect(url.length).toBeLessThan(140);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = origWindow;
    }
  });
});
