import React, { useState } from 'react';
import { X, Plus, Users, Sparkles } from 'lucide-react';
import { BillGroup, CurrencyCode } from '../types/bill';
import { CURRENCY_LIST } from '../utils/currencies';
import { createBlankGroup } from '../utils/demoData';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (group: BillGroup) => void;
}

const EMOJI_OPTIONS = ['🗼', '✈️', '🏕️', '🍻', '🎂', '🏖️', '🏠', '🎤', '🛒', '💸'];

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✈️');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TWD');
  const [memberInput, setMemberInput] = useState('Mona, 好友 A, 好友 B');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const names = memberInput
      .split(/[,，、\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const created = createBlankGroup(
      name || '好友聚餐出遊分帳',
      emoji,
      baseCurrency,
      names
    );
    onCreate(created);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <h2 className="text-lg font-bold">建立新分帳群組</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              選擇群組圖示
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition ${
                    emoji === em
                      ? 'bg-indigo-50 border-indigo-600 shadow-sm scale-105'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              群組 / 活動名稱 *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：沖繩四天三夜、週五居酒屋聚餐、合租室友水電"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              結算基準幣別（大家最後用哪種幣別結算轉帳）
            </label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              參與好友名單（以逗號或頓號分隔，之後隨時可新增）
            </label>
            <textarea
              rows={2}
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="例如：Mona, Alice, Bob, Kevin"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-semibold text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              立即建立分帳群組
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
