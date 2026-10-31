'use client';

import { useState } from 'react';
import { Coffee, CupSoda, Minus, NotebookPen, Plus, ShoppingBag, Snowflake, Timer, Zap } from 'lucide-react';
import {
  DEFAULT_CUSTOMIZATION,
  ICE_LEVELS,
  MAX_TOPPINGS,
  SIZE_OPTIONS,
  SUGAR_LEVELS,
  TOPPING_OPTIONS,
} from '../../data/menu-options';
import { discountPercent } from '../../lib/product-detail';
import { calcUnitPrice } from '../../lib/pricing';
import { DrinkCustomization, MenuProduct } from '../../types/menu';
import { formatCurrency } from '../../utils/format';
import { RatingStars } from '../ui/RatingStars';

const SIZE_ICONS = { M: Coffee, L: CupSoda } as const;

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors ${
    active ? 'bg-primary-container text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
  }`;

interface ProductConfiguratorProps {
  product: MenuProduct;
  series: string;
  onAddToCart: (customization: DrinkCustomization, quantity: number) => void;
  onBuyNow: (customization: DrinkCustomization, quantity: number) => void;
  onToppingLimit: () => void;
}

export const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  product,
  series,
  onAddToCart,
  onBuyNow,
  onToppingLimit,
}) => {
  const [customization, setCustomization] = useState<DrinkCustomization>(DEFAULT_CUSTOMIZATION);
  const [quantity, setQuantity] = useState(1);

  const discount = discountPercent(product);
  const total = calcUnitPrice(product.basePrice, customization) * quantity;
  const selectedSize = SIZE_OPTIONS.find((s) => s.code === customization.size)!;

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
    <div className="flex flex-col gap-space-md bg-surface-container-lowest p-space-md md:p-space-lg rounded-xl shadow-sm">
      {/* Tiêu đề & đánh giá */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-display text-label-sm text-secondary uppercase tracking-widest">{series}</span>
          <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-display text-label-sm">
            Mới pha hôm nay
          </span>
        </div>
        <h1 className="font-display text-headline-display-mobile md:text-[34px] md:leading-tight font-extrabold tracking-tight text-on-surface">
          {product.name}
        </h1>
        <div className="flex items-center gap-space-sm flex-wrap text-on-surface-variant">
          <RatingStars rating={product.rating} />
          <span className="font-display text-label-lg font-bold text-on-surface">{product.rating.toFixed(1)} / 5.0</span>
          <span className="text-outline-variant">•</span>
          <span className="text-body-sm underline decoration-dotted">{product.reviewCount} đánh giá từ khách hàng</span>
        </div>
      </div>

      {/* Giá */}
      <div className="flex items-baseline gap-space-sm py-space-xs flex-wrap">
        <span className="font-display text-headline-display font-extrabold text-primary-container">
          {formatCurrency(product.basePrice)}
        </span>
        {product.originalPrice && discount && (
          <>
            <span className="text-body-sm line-through text-outline">{formatCurrency(product.originalPrice)}</span>
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-display text-label-sm">
              Tiết kiệm {discount}%
            </span>
          </>
        )}
      </div>

      <p className="text-body-md text-on-surface-variant leading-relaxed">{product.description}</p>

      <div className="w-full h-px bg-surface-container" />

      {/* 1. Kích thước */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="w-full flex items-center justify-between mb-space-xs">
          <span className="font-display text-label-lg font-bold text-on-surface flex items-center gap-1.5">
            1. Chọn kích thước <span className="text-secondary font-normal text-label-sm">(Bắt buộc)</span>
          </span>
          <span className="font-display text-label-sm text-on-surface-variant">
            {selectedSize.label} ({selectedSize.volume})
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
          {SIZE_OPTIONS.map((size) => {
            const active = customization.size === size.code;
            const Icon = SIZE_ICONS[size.code];
            return (
              <button
                key={size.code}
                type="button"
                aria-pressed={active}
                onClick={() => setCustomization({ ...customization, size: size.code })}
                className={`relative flex flex-col items-center px-3 pb-3 pt-5 rounded-xl text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  active
                    ? 'bg-secondary-fixed/40 text-on-secondary-fixed shadow-[0_2px_8px_rgba(43,24,16,0.08)] ring-1 ring-secondary/30'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {size.code === 'M' && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 rounded-full bg-secondary text-on-secondary font-display text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Khuyên dùng
                  </span>
                )}
                <Icon className={`w-5 h-5 ${active ? 'text-secondary' : 'text-outline'}`} />
                <span className="font-display text-label-md font-bold mt-1">{size.label}</span>
                <span className="text-body-sm text-on-surface-variant">{size.volume}</span>
                <span className={`font-display text-label-sm mt-2 ${active ? 'text-secondary' : 'text-on-surface'}`}>
                  {size.extraPrice ? `+${formatCurrency(size.extraPrice)}` : formatCurrency(product.basePrice)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Topping */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="w-full flex items-center justify-between mb-space-xs">
          <span className="font-display text-label-lg font-bold text-on-surface">2. Thêm Topping &amp; Nâng Cấp</span>
          <span className="text-xs text-outline">Tối đa {MAX_TOPPINGS} loại</span>
        </legend>
        <div className="flex flex-col gap-space-xs">
          {TOPPING_OPTIONS.map((topping) => (
            <label
              key={topping.id}
              className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors select-none"
            >
              <span className="flex items-center gap-space-sm">
                <input
                  type="checkbox"
                  checked={customization.toppingIds.includes(topping.id)}
                  onChange={() => toggleTopping(topping.id)}
                  className="w-5 h-5 rounded accent-primary-container cursor-pointer"
                />
                <span className="text-body-md text-on-surface font-medium">{topping.name}</span>
              </span>
              <span className="font-display text-label-md text-secondary font-bold">+{formatCurrency(topping.price)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 3. Độ ngọt & đá */}
      <fieldset className="flex flex-col gap-space-sm">
        <legend className="font-display text-label-lg font-bold text-on-surface mb-space-xs">3. Độ ngọt &amp; Lượng đá</legend>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Độ ngọt">
          {SUGAR_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={customization.sugar === level}
              onClick={() => setCustomization({ ...customization, sugar: level })}
              className={pillClass(customization.sugar === level)}
            >
              Đường {level}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lượng đá">
          {ICE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={customization.ice === level}
              onClick={() => setCustomization({ ...customization, ice: level })}
              className={pillClass(customization.ice === level)}
            >
              {level === 'Không đá' ? level : `Đá ${level}`}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Ghi chú */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="barista-note" className="font-display text-label-lg font-bold text-on-surface flex items-center gap-1">
          <NotebookPen className="w-[18px] h-[18px] text-secondary" />
          Ghi chú cho Barista
        </label>
        <input
          id="barista-note"
          type="text"
          maxLength={120}
          value={customization.note}
          onChange={(e) => setCustomization({ ...customization, note: e.target.value })}
          placeholder="Ví dụ: nhiều sữa đặc, tách đá riêng, mang đi..."
          className="w-full px-space-md py-3 rounded-full bg-surface-container text-on-surface placeholder:text-outline text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
        />
      </div>

      {/* Số lượng & tổng */}
      <div className="p-space-md bg-surface-container rounded-xl flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm w-full sm:w-auto justify-between sm:justify-start">
          <span className="font-display text-label-md text-on-surface-variant">Số lượng:</span>
          <div className="flex items-center bg-surface-container-lowest rounded-full p-1 shadow-sm">
            <button
              type="button"
              aria-label="Giảm số lượng"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <Minus className="w-[18px] h-[18px]" />
            </button>
            <span data-testid="detail-qty" className="w-10 text-center font-display text-headline-sm font-bold text-on-surface">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Tăng số lượng"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end w-full sm:w-auto">
          <span className="font-display text-label-sm text-on-surface-variant">Tổng thanh toán:</span>
          <span data-testid="detail-total" className="font-display text-headline-lg font-extrabold text-secondary">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Hành động */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-space-xs">
        <button
          type="button"
          disabled={!product.isAvailable}
          onClick={() => onAddToCart(customization, quantity)}
          className="flex items-center justify-center gap-2 py-3.5 px-space-lg rounded-full bg-primary-container text-on-primary font-display text-label-lg font-bold hover:bg-primary shadow-[0_4px_16px_rgba(43,24,16,0.15)] active:scale-[0.98] transition-all disabled:bg-surface-container-highest disabled:text-outline disabled:shadow-none disabled:cursor-not-allowed"
        >
          <ShoppingBag className="w-5 h-5" />
          {product.isAvailable ? 'THÊM VÀO GIỎ HÀNG' : 'TẠM HẾT MÓN'}
        </button>
        <button
          type="button"
          disabled={!product.isAvailable}
          onClick={() => onBuyNow(customization, quantity)}
          className="flex items-center justify-center gap-2 py-3.5 px-space-lg rounded-full bg-secondary text-on-secondary font-display text-label-lg font-bold hover:bg-on-secondary-container shadow-[0_4px_16px_rgba(142,77,42,0.2)] active:scale-[0.98] transition-all disabled:bg-surface-container-highest disabled:text-outline disabled:shadow-none disabled:cursor-not-allowed"
        >
          <Zap className="w-5 h-5" />
          MUA NGAY
        </button>
      </div>

      <div className="flex items-center justify-center gap-space-md text-on-surface-variant font-display text-label-sm flex-wrap">
        <span className="flex items-center gap-1">
          <Timer className="w-4 h-4 text-secondary" /> Giao nhanh trong 20 phút
        </span>
        <span className="text-outline-variant">•</span>
        <span className="flex items-center gap-1">
          <Snowflake className="w-4 h-4 text-secondary" /> Đá viên bảo quản riêng
        </span>
      </div>
    </div>
  );
};
