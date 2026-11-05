'use client';

import Link from 'next/link';
import { ChevronDown, Minus, NotebookPen, Plus, PlusCircle, SlidersHorizontal, Trash2 } from 'lucide-react';
import { SIZE_OPTIONS, TOPPING_OPTIONS } from '../../data/menu-options';
import { CartItem, MAX_LINE_QUANTITY } from '../../lib/cart';
import { MenuProduct, SizeCode } from '../../types/menu';
import { formatCurrency } from '../../utils/format';

interface CartLineItemProps {
  item: CartItem;
  /** Món tương ứng trong thực đơn (để lấy badge và link chi tiết) — có thể không còn. */
  product?: MenuProduct;
  onQuantityChange: (quantity: number) => void;
  onSizeChange: (size: SizeCode) => void;
  onRemove: () => void;
}

export const CartLineItem: React.FC<CartLineItemProps> = ({ item, product, onQuantityChange, onSizeChange, onRemove }) => {
  const { customization } = item;
  const sizes = item.productOptions
    ? item.productOptions.filter((o) => o.type === 'SIZE').map((o) => ({ code: o.id, label: o.name, extraPrice: o.extraPrice }))
    : SIZE_OPTIONS;
  const toppingOptions = item.productOptions
    ? item.productOptions.filter((o) => o.type === 'TOPPING').map((o) => ({ id: o.id, name: o.name, price: o.extraPrice }))
    : TOPPING_OPTIONS;
  const toppings = customization.toppingIds
    .map((id) => toppingOptions.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const detailHref = item.productOptions ? `/thuc-don/${item.productId}` : product ? `/thuc-don/${product.slug}` : undefined;

  return (
    <article
      data-testid={`cart-line-${item.productId}`}
      aria-label={item.name}
      className="p-space-md md:p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-space-md"
    >
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-surface-container overflow-hidden flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        {product?.badge && (
          <span className="absolute top-1.5 left-1.5 right-1.5 w-fit max-w-full truncate px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-display text-label-sm">
            {product.badge.label}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
        <div className="flex items-start justify-between gap-space-xs">
          <h2 className="font-display text-headline-sm font-bold text-on-surface truncate">
            {detailHref ? (
              <Link href={detailHref} className="hover:text-secondary transition-colors">
                {item.name}
              </Link>
            ) : (
              item.name
            )}
          </h2>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Xóa ${item.name}`}
            className="text-on-surface-variant hover:text-error p-1 rounded-full hover:bg-surface-container transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs pt-1">
          <div className="relative">
            <select
              value={customization.size}
              onChange={(e) => onSizeChange(e.target.value as SizeCode)}
              aria-label={`Chọn size cho ${item.name}`}
              className="w-full appearance-none bg-surface-container-low text-on-surface font-display text-label-md py-1.5 pl-3 pr-8 rounded-full cursor-pointer focus:outline-none focus:bg-surface-container"
            >
              {sizes.length === 0 && <option value="">Tiêu chuẩn</option>}
              {sizes.map((size) => (
                <option key={size.code} value={size.code}>
                  {size.label} ({size.extraPrice ? `+${formatCurrency(size.extraPrice)}` : 'Tiêu chuẩn'})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant font-display text-label-sm min-w-0">
            <PlusCircle className="w-[15px] h-[15px] text-secondary shrink-0" />
            <span className="truncate" title={toppings.map((t) => t.name).join(', ')}>
              {toppings.length
                ? `Topping: ${toppings.map((t) => `${t.name} (+${formatCurrency(t.price)})`).join(', ')}`
                : 'Không topping'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-outline" />
          <span className="text-body-sm text-on-surface-variant bg-surface-container-high px-2.5 py-0.5 rounded-full">
            Đường {customization.sugar} · Đá {customization.ice}
          </span>
          {customization.note && (
            <span className="flex items-center gap-1 text-body-sm text-on-surface-variant bg-surface-container-high px-2.5 py-0.5 rounded-full">
              <NotebookPen className="w-3 h-3" /> Ghi chú: {customization.note}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs mt-1">
          <div className="flex flex-col">
            <span className="font-display text-label-sm text-on-surface-variant">Đơn giá</span>
            <span className="font-display text-headline-sm font-bold text-on-surface">{formatCurrency(item.unitPrice)}</span>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center bg-surface-container-low p-1 rounded-full shadow-inner">
              <button
                type="button"
                aria-label={`Giảm số lượng ${item.name}`}
                onClick={() => onQuantityChange(item.quantity - 1)}
                className="w-7 h-7 rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-all shadow-sm"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span data-testid="line-qty" className="w-8 text-center font-display text-headline-sm font-bold text-on-surface">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label={`Tăng số lượng ${item.name}`}
                disabled={item.quantity >= MAX_LINE_QUANTITY}
                onClick={() => onQuantityChange(item.quantity + 1)}
                className="w-7 h-7 rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-all shadow-sm disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-right min-w-[90px]">
              <span className="font-display text-label-sm text-on-surface-variant block">Thành tiền</span>
              <span data-testid="line-subtotal" className="font-display text-headline-sm font-bold text-secondary">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
