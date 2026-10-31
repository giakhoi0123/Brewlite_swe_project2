'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import {
  DEFAULT_CUSTOMIZATION,
  ICE_LEVELS,
  MAX_TOPPINGS,
  SIZE_OPTIONS,
  SUGAR_LEVELS,
  TOPPING_OPTIONS,
} from '../../data/menu-options';
import { calcUnitPrice } from '../../lib/pricing';
import { DrinkCustomization, MenuProduct } from '../../types/menu';
import { formatCurrency } from '../../utils/format';

interface CustomizeModalProps {
  product: MenuProduct | null;
  onClose: () => void;
  onConfirm: (product: MenuProduct, customization: DrinkCustomization, quantity: number) => void;
  onToppingLimit: () => void;
}

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors ${
    active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
  }`;

export const CustomizeModal: React.FC<CustomizeModalProps> = ({ product, onClose, onConfirm, onToppingLimit }) => {
  const [customization, setCustomization] = useState<DrinkCustomization>(DEFAULT_CUSTOMIZATION);
  const [quantity, setQuantity] = useState(1);

  // Mỗi lần mở món mới thì reset lựa chọn về mặc định.
  useEffect(() => {
    if (product) {
      setCustomization(DEFAULT_CUSTOMIZATION);
      setQuantity(1);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [product, onClose]);

  if (!product) return null;

  const unitPrice = calcUnitPrice(product.basePrice, customization);
  const total = unitPrice * quantity;

  const toggleTopping = (id: string) => {
    const selected = customization.toppingIds;
    if (selected.includes(id)) {
      setCustomization({ ...customization, toppingIds: selected.filter((t) => t !== id) });
    } else if (selected.length >= MAX_TOPPINGS) {
      onToppingLimit();
    } else {
      setCustomization({ ...customization, toppingIds: [...selected, id] });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-space-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-space-md bg-surface-container-low border-b border-surface-container">
          <div>
            <span className="font-display text-label-sm text-secondary">{product.code}</span>
            <h3 id="customize-title" className="font-display text-headline-sm text-on-surface">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-outline hover:text-on-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-space-md overflow-y-auto space-y-space-md">
          <fieldset>
            <legend className="w-full font-display text-label-md text-on-surface mb-2 flex items-center justify-between">
              <span>Chọn Kích Cỡ</span>
              <span className="text-secondary font-bold text-xs">Bắt buộc</span>
            </legend>
            <div className="grid grid-cols-2 gap-space-xs">
              {SIZE_OPTIONS.map((size) => {
                const active = customization.size === size.code;
                return (
                  <button
                    key={size.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCustomization((prev) => ({ ...prev, size: size.code }))}
                    className={`p-space-sm rounded-lg text-left flex flex-col transition-all ${
                      active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="font-display text-label-md font-bold">
                      {size.label} ({size.volume})
                    </span>
                    <span className={`text-xs ${active ? 'opacity-80' : size.extraPrice ? 'text-secondary font-semibold' : 'opacity-80'}`}>
                      {size.extraPrice ? `+${formatCurrency(size.extraPrice)}` : 'Tiêu chuẩn'}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-display text-label-md text-on-surface mb-2">Độ Ngọt (Lượng Đường)</legend>
            <div className="flex flex-wrap gap-1.5">
              {SUGAR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={customization.sugar === level}
                  onClick={() => setCustomization((prev) => ({ ...prev, sugar: level }))}
                  className={pillClass(customization.sugar === level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-display text-label-md text-on-surface mb-2">Lượng Đá</legend>
            <div className="flex flex-wrap gap-1.5">
              {ICE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={customization.ice === level}
                  onClick={() => setCustomization((prev) => ({ ...prev, ice: level }))}
                  className={pillClass(customization.ice === level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="w-full font-display text-label-md text-on-surface mb-2 flex items-center justify-between">
              <span>Topping Thêm (Tùy chọn)</span>
              <span className="text-xs text-outline">Tối đa {MAX_TOPPINGS} loại</span>
            </legend>
            <div className="space-y-1.5">
              {TOPPING_OPTIONS.map((topping) => (
                <label
                  key={topping.id}
                  className="flex items-center justify-between p-space-xs rounded-lg hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customization.toppingIds.includes(topping.id)}
                      onChange={() => toggleTopping(topping.id)}
                      className="w-4 h-4 rounded accent-secondary"
                    />
                    <span className="text-body-sm text-on-surface">{topping.name}</span>
                  </span>
                  <span className="font-display text-label-sm text-secondary">+{formatCurrency(topping.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between pt-space-xs border-t border-surface-container">
            <span className="font-display text-label-md text-on-surface">Số lượng ly</span>
            <div className="flex items-center gap-space-sm bg-surface-container px-space-sm py-1 rounded-full">
              <button
                type="button"
                aria-label="Giảm số lượng"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span data-testid="modal-qty" className="font-display text-headline-sm font-bold w-6 text-center text-primary">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-space-md bg-surface-container-low flex items-center justify-between gap-space-md">
          <div>
            <span className="font-display text-label-sm text-outline">Tạm tính:</span>
            <p data-testid="modal-total" className="font-display text-headline-md font-bold text-primary">
              {formatCurrency(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(product, customization, quantity)}
            className="flex-1 py-3 px-space-lg rounded-full bg-primary text-on-primary font-display text-label-lg hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <ShoppingBag className="w-[18px] h-[18px]" />
            <span>Xác nhận thêm món</span>
          </button>
        </div>
      </div>
    </div>
  );
};
