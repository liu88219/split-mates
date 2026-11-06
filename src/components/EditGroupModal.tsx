import React, { useState, useEffect } from 'react';
import {
  X,
  Archive,
  ArchiveRestore,
  Trash2,
  Image as ImageIcon,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { BillGroup, CurrencyCode } from '../types/bill';
import { CURRENCY_LIST } from '../utils/currencies';
import { BoboFaceBadge } from './QuokkaBoboArt';

interface EditGroupModalProps {
  isOpen: boolean;
  group: BillGroup;
  onClose: () => void;
  onSave: (updated: BillGroup) => void;
  onToggleArchive: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

const EMOJI_OPTIONS = [
  '🧸',
  '🍪',
  '🏖️',
  '🗼',
  '✈️',
  '🏕️',
  '🍻',
  '🍽️',
  '🎂',
  '🏠',
  '🎤',
  '🛒',
  '💸',
  '🚄',
  '🎡',
  '♨️',
  '🤿',
  '🚗',
  '🐾',
];

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  isOpen,
  group,
  onClose,
  onSave,
  onToggleArchive,
  onDeleteGroup,
}) => {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [emoji, setEmoji] = useState(group.coverEmoji || '🧸');
  const [coverImageUrl, setCoverImageUrl] = useState(group.coverImageUrl || '');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(group.baseCurrency);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(group.name);
    setDescription(group.description || '');
    setEmoji(group.coverEmoji || '🧸');
    setCoverImageUrl(group.coverImageUrl || '');
    setBaseCurrency(group.baseCurrency);
    setConfirmDelete(false);
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 96;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            setCoverImageUrl(canvas.toDataURL('image/jpeg', 0.72));
          } else {
            setCoverImageUrl(reader.result as string);
          }
        };
        img.onerror = () => setCoverImageUrl(reader.result as string);
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...group,
      name: name.trim(),
      description: description.trim() || undefined,
      coverEmoji: emoji,
      coverImageUrl: coverImageUrl.trim() || undefined,
      baseCurrency,
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3E2C1E]/45 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFFDF9] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-2 border-[#3E2C1E] shadow-[0_8px_0_#3E2C1E] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FAF1E2] border-b-2 border-[#E6D4BE] text-[#3E2C1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <BoboFaceBadge className="w-8 h-8 shrink-0" />
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              ✏️ 編輯群組資訊 / 封存與刪除
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

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Group Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#6E5643] mb-1">
                群組 / 旅程名稱 *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：高雄兩天一夜之旅"
                className="w-full px-3.5 py-2.5 text-sm font-bold cream-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6E5643] mb-1">
                群組簡介 / 備註（選填）
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：駁二、瑞豐夜市、飯店與高鐵分帳"
                className="w-full px-3.5 py-2 text-sm cream-input"
              />
            </div>
          </div>

          {/* Group Icon Emoji & Custom Picture Upload */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#FAF6EE] border-2 border-[#E6D6C3]">
            <label className="block text-xs font-bold text-[#5C4432]">
              群組代表圖示 (Emoji) 或自訂照片
            </label>

            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setEmoji(em);
                    setCoverImageUrl('');
                  }}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition ${
                    emoji === em && !coverImageUrl
                      ? 'bg-[#FCE394] text-[#3E2C1E] border-2 border-[#3E2C1E] shadow-[0_2px_0_#3E2C1E] scale-105'
                      : 'bg-[#FFFDF9] border border-[#E5D5C1] hover:bg-[#F3E8D8]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            <div className="pt-2.5 border-t border-[#E6D6C3] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                {coverImageUrl ? (
                  <img
                    src={coverImageUrl}
                    alt="群組自訂圖片"
                    className="w-11 h-11 rounded-2xl object-cover border-2 border-[#3E2C1E] shadow-sm"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-[#FCE394] border-2 border-[#3E2C1E] text-[#3E2C1E] flex items-center justify-center text-xl font-bold">
                    {emoji}
                  </div>
                )}
                <div className="text-xs text-[#6E5643]">
                  <div className="font-bold text-[#3E2C1E]">上傳自訂群組照片</div>
                  <div className="text-[11px] text-[#8C735D]">
                    可選手機相簿照片作為群組頭像
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 btn-bobo">
                  <ImageIcon className="w-3.5 h-3.5 text-[#B06D3E]" />
                  <span>選擇照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="text-xs text-[#B94A3E] font-bold hover:underline"
                  >
                    移除照片
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Base Currency */}
          <div>
            <label className="block text-xs font-bold text-[#6E5643] mb-1">
              基準結算幣別
            </label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2.5 text-sm font-bold cream-input"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-1.5 btn-quokka"
          >
            <Save className="w-4 h-4" />
            儲存群組名稱與圖示修改
          </button>

          <hr className="border-[#EADCCB]" />

          {/* Trip Finished: Archive or Permanently Delete */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-[#8C735D] uppercase tracking-wider">
              📦 旅程結束收納 / 刪除群組
            </h3>

            {/* Option 1: Move to Archived Trips */}
            <div className="p-3.5 rounded-2xl bg-[#FFF7DC] border-2 border-[#EAD084] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-[#4A3525]">
                  {group.isArchived
                    ? '📂 此旅程目前在「歷史封存區」'
                    : '📦 旅程結束了？移至「歷史封存區」'}
                </div>
                <div className="text-[11px] text-[#7A5E3A] mt-0.5">
                  {group.isArchived
                    ? '點選右側按鈕即可還原回「進行中」清單'
                    : '收進封存區後不會出現在上方主清單，但隨時可點開「歷史封存」查舊帳'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleArchive(group.id);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 btn-butter"
              >
                {group.isArchived ? (
                  <>
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    還原至進行中
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5" />
                    封存此旅程
                  </>
                )}
              </button>
            </div>

            {/* Option 2: Permanent Delete */}
            <div className="p-3.5 rounded-2xl bg-[#FDF0EE] border-2 border-[#EFC6BF] space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#6E2B23]">
                    🗑️ 永久刪除此分帳群組
                  </div>
                  <div className="text-[11px] text-[#9C4942] mt-0.5">
                    將「{group.name}」徹底移除（例如不需要預設範例或測試群組時）
                  </div>
                </div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#FFFDF9] border-2 border-[#DFA39A] hover:bg-[#FCE4E0] text-[#A63D32] text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    刪除此群組
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#D9C7B2] text-[#6E5643] text-xs font-bold"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteGroup(group.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#C85A4B] hover:bg-[#B24B3D] text-[#FFFDF9] border-2 border-[#3E2C1E] text-xs font-extrabold flex items-center gap-1 shadow-[0_2px_0_#3E2C1E]"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      確定永久刪除
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
