import { CurrencyCode } from '../types/bill';

export interface DetectedReceiptItem {
  id: string;
  name: string;
  quantity: number;
  amount: number; // Line total amount (already quantity * unitPrice)
  selected: boolean;
  assignedMemberIds: string[];
}

export interface ReceiptScanResult {
  storeName?: string;
  currency?: CurrencyCode;
  serviceFeePercent?: number;
  items: Array<{
    name: string;
    quantity: number;
    amount: number;
  }>;
  engine: 'gemini-vision' | 'local-ocr';
  rawText?: string;
}

const GEMINI_KEY_STORAGE = 'splitmates_gemini_api_key_v1';

export function getSavedGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(GEMINI_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  } catch {
    // ignore
  }
}

const NOISE_KEYWORDS = [
  '合計',
  '總計',
  '總金額',
  '小計',
  '應付',
  '實收',
  '實付',
  '現金',
  '找零',
  '信用卡',
  '刷卡',
  '統編',
  '統一編號',
  '發票',
  '電子發票',
  '隨機碼',
  '賣方',
  '買方',
  '電話',
  '地址',
  '日期',
  '時間',
  '營業',
  '桌號',
  '單號',
  '序號',
  '機號',
  '收銀',
  '人數',
  '稅額',
  '免稅',
  '應稅',
  '銷售額',
  '載具',
  '會員',
  '點數',
  '折扣合計',
  '謝謝光臨',
  '歡迎光臨',
  'total',
  'subtotal',
  'sub-total',
  'cash',
  'change',
  'credit',
  'visa',
  'mastercard',
  'jcb',
  'tax',
  'vat',
  'gst',
  'receipt',
  'invoice',
  'tel:',
  'date:',
  'time:',
  'table',
];

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase().replace(/\s+/g, '');
  if (lower.length < 2) return true;
  // Pure date/time/phone/invoice number patterns
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(lower)) return true;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(lower)) return true;
  if (/^[a-z]{2}-?\d{8}$/i.test(lower)) return true;
  if (/^0\d-\d{7,8}$/.test(lower)) return true;

  return NOISE_KEYWORDS.some((kw) => lower.includes(kw));
}

function cleanItemName(raw: string): string {
  return raw
    .replace(/^[\d#*\-•·.)]+\s*/, '') // leading bullet or index "1. "
    .replace(/[xX×*]\s*\d+\s*$/, '') // trailing quantity "x2"
    .replace(/[$¥€£₩]|NT\$|HK\$|US\$/gi, '')
    .replace(/[._\-…:：|]+$/g, '')
    .trim();
}

/**
 * 智慧解析 OCR 文字行（支援台灣電子發票明細、餐廳點餐單、日文/英文收據與服務費偵測）
 */
export function parseReceiptTextToItems(rawText: string): {
  storeName?: string;
  currency?: CurrencyCode;
  serviceFeePercent?: number;
  items: Array<{ name: string; quantity: number; amount: number }>;
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedCurrency: CurrencyCode | undefined;
  if (/[¥￥]|円/.test(rawText)) {
    detectedCurrency = 'JPY';
  } else if (/₩|원|KRW/i.test(rawText)) {
    detectedCurrency = 'KRW';
  } else if (/NT\$|台幣|元|統編|發票/.test(rawText)) {
    detectedCurrency = 'TWD';
  }

  let serviceFeePercent: number | undefined;
  const items: Array<{ name: string; quantity: number; amount: number }> = [];
  let pendingNameOnlyLine: string | null = null;

  for (const line of lines) {
    // Check service fee line e.g. "10% 服務費" or "服務費 10%"
    if (/服務費|service\s*(charge|fee)/i.test(line)) {
      const pctMatch = line.match(/(\d{1,2})\s*%/);
      serviceFeePercent = pctMatch ? Number(pctMatch[1]) : 10;
      pendingNameOnlyLine = null;
      continue;
    }

    if (isNoiseLine(line)) {
      pendingNameOnlyLine = null;
      continue;
    }

    // Case A: Taiwan 2-line e-invoice price row e.g. "45TX * 2  90TX" or "120  1  120TX"
    const twTwoLineMatch = line.match(
      /^[$¥]?\s*(\d+(?:\.\d{1,2})?)\s*(?:TX|tx)?\s*[xX×*\s]+\s*(\d+)\s+[$¥]?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:TX|tx|元|円)?$/
    );
    if (twTwoLineMatch && pendingNameOnlyLine) {
      const qty = Math.max(1, parseInt(twTwoLineMatch[2], 10) || 1);
      const amt = parseFloat(twTwoLineMatch[3].replace(/,/g, ''));
      if (amt > 0 && amt < 500000) {
        items.push({
          name: cleanItemName(pendingNameOnlyLine),
          quantity: qty,
          amount: amt,
        });
        pendingNameOnlyLine = null;
        continue;
      }
    }

    // Case B: Single-line item with name + optional qty + price at the end
    // Examples:
    // "經典拿鐵(冰)   $135"
    // "松露薯條 x2   240"
    // "珍珠奶茶  1  65  65"
    // "牛タン定食  ¥1,980"
    const priceAtEndMatch = line.match(
      /^(.+?)\s+(?:(?:NT\$|HK\$|US\$|[$¥€£₩])\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:TX|tx|元|円)?$/
    );

    if (priceAtEndMatch) {
      let leftPart = priceAtEndMatch[1].trim();
      const whole = priceAtEndMatch[2].replace(/,/g, '');
      const dec = priceAtEndMatch[3] ? `.${priceAtEndMatch[3]}` : '';
      const amount = parseFloat(`${whole}${dec}`);

      // Extract optional quantity at the end of leftPart: e.g. "珍珠奶茶 2 65" or "松露薯條 x2"
      let quantity = 1;
      const qtyUnitMatch = leftPart.match(/^(.+?)\s+(\d{1,2})\s+\d+(?:\.\d+)?$/);
      if (qtyUnitMatch) {
        leftPart = qtyUnitMatch[1].trim();
        quantity = Math.max(1, parseInt(qtyUnitMatch[2], 10) || 1);
      } else {
        const xQtyMatch = leftPart.match(/^(.+?)\s*[xX×*]\s*(\d{1,2})$/);
        if (xQtyMatch) {
          leftPart = xQtyMatch[1].trim();
          quantity = Math.max(1, parseInt(xQtyMatch[2], 10) || 1);
        }
      }

      const cleanedName = cleanItemName(leftPart);
      // Valid item name should contain at least one letter or CJK character and reasonable price
      if (
        cleanedName.length >= 1 &&
        /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7afa-zA-Z]/.test(cleanedName) &&
        !isNoiseLine(cleanedName) &&
        amount > 0 &&
        amount < 500000 &&
        // Avoid matching 8-digit numbers or years as prices when name is tiny
        !(amount >= 1990 && amount <= 2035 && cleanedName.length <= 2)
      ) {
        items.push({
          name: cleanedName,
          quantity,
          amount,
        });
        pendingNameOnlyLine = null;
        continue;
      }
    }

    // Keep track of pure text line in case next line is a Taiwan e-invoice price line ("65TX * 1 65TX")
    if (
      /[\u4e00-\u9fa5\u3040-\u30ffa-zA-Z]/.test(line) &&
      !/^\d+$/.test(line) &&
      line.length <= 32
    ) {
      pendingNameOnlyLine = line;
    } else {
      pendingNameOnlyLine = null;
    }
  }

  return {
    currency: detectedCurrency,
    serviceFeePercent,
    items,
  };
}

/**
 * 將收據圖片縮放並輸出為適合辨識的 DataURL（選擇性轉為高對比灰階以提升本機 OCR 準確率）
 */
async function preprocessReceiptImage(
  file: File,
  enhanceForLocalOcr: boolean
): Promise<{ dataUrl: string; base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取照片檔案'));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('照片格式無法載入'));
      img.onload = () => {
        const maxDim = enhanceForLocalOcr ? 1600 : 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const commaIdx = src.indexOf(',');
          resolve({
            dataUrl: src,
            base64Data: commaIdx !== -1 ? src.slice(commaIdx + 1) : src,
            mimeType: file.type || 'image/jpeg',
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        if (enhanceForLocalOcr) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          // Mild contrast stretching + grayscale for crisp thermal receipt OCR
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
            d[i] = contrasted;
            d[i + 1] = contrasted;
            d[i + 2] = contrasted;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const outMime = 'image/jpeg';
        const outUrl = canvas.toDataURL(outMime, 0.85);
        const commaIdx = outUrl.indexOf(',');
        resolve({
          dataUrl: outUrl,
          base64Data: commaIdx !== -1 ? outUrl.slice(commaIdx + 1) : outUrl,
          mimeType: outMime,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 使用 Gemini 2.5 Flash 多模態視覺擷取收據所有品項與金額
 */
async function scanWithGeminiVision(
  file: File,
  apiKey: string
): Promise<ReceiptScanResult> {
  const { base64Data, mimeType } = await preprocessReceiptImage(file, false);

  const prompt = `你是一位精準的收據與菜單明細辨識助手。請辨識這張收據、發票明細或點餐單照片中的所有「消費品項」與「該項小計金額（若數量>1請給該品項加總後的小計金額）」。
請忽略「總計、合計、小計、現金、找零、統編、稅額」等非單一品項列；若有「10%服務費/清潔費」請填入 serviceFeePercent（例如 10，沒有則填 0）。
請輸出純 JSON 格式：
{
  "storeName": "店家或餐廳名稱（若看不出來可填空字串）",
  "currency": "TWD 或 JPY 或 USD 或 KRW 或 EUR 或 HKD 或 THB",
  "serviceFeePercent": 0,
  "items": [
    { "name": "品項名稱", "quantity": 1, "amount": 120 }
  ]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`AI 辨識連線失敗 (${res.status})`);
  }

  const data = await res.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(rawJson);

  const validCurrencies: CurrencyCode[] = [
    'TWD',
    'JPY',
    'USD',
    'KRW',
    'EUR',
    'HKD',
    'THB',
    'SGD',
  ];
  const curr = validCurrencies.includes(parsed.currency)
    ? (parsed.currency as CurrencyCode)
    : undefined;

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter(
          (it: { name?: unknown; amount?: unknown }) =>
            typeof it?.name === 'string' &&
            it.name.trim().length > 0 &&
            Number(it?.amount) > 0
        )
        .map((it: { name: string; quantity?: number; amount: number }) => ({
          name: it.name.trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          amount: Number(it.amount),
        }))
    : [];

  return {
    storeName: typeof parsed.storeName === 'string' ? parsed.storeName.trim() : undefined,
    currency: curr,
    serviceFeePercent: Number(parsed.serviceFeePercent) || 0,
    items,
    engine: 'gemini-vision',
  };
}

/**
 * 雙引擎收據掃描：
 * - 若使用者已設定 Gemini API Key，優先使用 Gemini Vision 超精準辨識（失敗時自動降級本機 OCR）
 * - 預設免設定直接使用內建 Tesseract.js 繁體中文+英文+數字 OCR 引擎
 */
export async function recognizeReceiptImage(
  file: File,
  onProgress?: (statusText: string, progressRatio: number) => void
): Promise<ReceiptScanResult> {
  const apiKey = getSavedGeminiApiKey();

  if (apiKey) {
    try {
      onProgress?.('✨ 正在使用 AI 智慧視覺解析收據品項與金額...', 0.45);
      const aiResult = await scanWithGeminiVision(file, apiKey);
      onProgress?.('✅ 辨識完成！', 1);
      return aiResult;
    } catch (err) {
      console.warn('Gemini Vision fallback to local OCR:', err);
    }
  }

  onProgress?.('📷 正在強化收據影像清晰度...', 0.1);
  const { dataUrl } = await preprocessReceiptImage(file, true);

  onProgress?.('🔍 正在載入繁中/英文 OCR 辨識引擎...', 0.2);
  const Tesseract = await import('tesseract.js');

  const result = await Tesseract.recognize(dataUrl, 'chi_tra+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        const pct = Math.round(m.progress * 100);
        onProgress?.(`🔍 正在掃描品項與價錢 (${pct}%)...`, 0.25 + m.progress * 0.7);
      }
    },
  });

  const rawText = result?.data?.text || '';
  const parsed = parseReceiptTextToItems(rawText);
  onProgress?.('✅ 掃描完成！', 1);

  return {
    ...parsed,
    engine: 'local-ocr',
    rawText,
  };
}
