'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, Plus, SlidersHorizontal, Star } from 'lucide-react';
import { getCategory } from '../../data/menu-categories';
import { SIZE_OPTIONS } from '../../data/menu-options';
import { BadgeTone, MenuProduct } from '../../types/menu';
import { formatCurrency } from '../../utils/format';
import { ICONS } from '../ui/icon-map';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop&auto=format&q=80';

const BADGE_TONES: Record<BadgeTone, string> = {
  caramel: 'bg-secondary text-on-secondary',
  peach: 'bg-secondary-container text-on-secondary-container',
  espresso: 'bg-primary-container text-surface-bright',
  cream: 'bg-surface-container-high text-on-surface',
  latte: 'bg-secondary-fixed-dim text-on-secondary-fixed-variant',
};

const SIZE_L_EXTRA = SIZE_OPTIONS.find((size) => size.code === 'L')?.extraPrice ?? 0;

interface MenuProductCardProps {
  product: MenuProduct;
  isFavorite: boolean;
  onToggleFavorite: (product: MenuProduct) => void;
  onCustomize: (product: MenuProduct) => void;
  onQuickAdd: (product: MenuProduct) => void;
}

export const MenuProductCard: React.FC<MenuProductCardProps> = ({
  product,
  isFavorite,
  onToggleFavorite,
  onCustomize,
  onQuickAdd,
}) => {
  const [imgSrc, setImgSrc] = useState(product.imageUrl);
  const category = getCategory(product.categoryId);
  const BadgeIconComp = product.badge ? ICONS[product.badge.icon] : null;
  const detailHref = `/thuc-don/${product.slug}`;

  return (
    <article
      data-testid={`menu-card-${product.id}`}
      aria-label={product.name}
      className={`group flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-xl transition-all duration-300 ${
        product.isAvailable ? '' : 'opacity-75'
      }`}
    >
      <div>
        <div className="relative w-full h-56 rounded-lg overflow-hidden bg-surface-container-low mb-space-sm">
          <Link href={detailHref} tabIndex={-1} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={product.name}
              loading="lazy"
              onError={() => setImgSrc(FALLBACK_IMAGE)}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                product.isAvailable ? 'group-hover:scale-105' : 'grayscale'
              }`}
            />
          </Link>

          {product.badge && BadgeIconComp && (
            <div className="absolute top-space-sm left-space-sm">
              <span
                className={`px-2.5 py-1 rounded-full font-display text-label-sm shadow-sm flex items-center gap-1 ${
                  BADGE_TONES[product.badge.tone]
                }`}
              >
                <BadgeIconComp className="w-3 h-3" />
                {product.badge.label}
              </span>
            </div>
          )}

          {!product.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/40 pointer-events-none">
              <span className="px-space-md py-1 rounded-full bg-surface text-on-surface font-display text-label-md">
                Tạm hết món
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(product)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
            className={`absolute top-space-sm right-space-sm w-9 h-9 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center transition-colors shadow-sm ${
              isFavorite ? 'text-error' : 'text-outline hover:text-error'
            }`}
          >
            <Heart className="w-[18px] h-[18px]" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-display text-label-sm text-secondary">
            {category?.shortLabel} • {product.code}
          </span>
          <div className="flex items-center gap-1 text-secondary">
            <Star className="w-4 h-4" fill="currentColor" />
            <span className="font-display text-label-md font-bold">{product.rating.toFixed(1)}</span>
            <span className="text-body-sm text-outline">({product.reviewCount})</span>
          </div>
        </div>

        <h3 className="font-display text-headline-sm text-on-surface group-hover:text-secondary transition-colors mb-1">
          <Link href={detailHref} className="focus:outline-none focus-visible:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-space-sm">{product.description}</p>
      </div>

      <div className="pt-space-sm">
        <div className="flex items-baseline justify-between mb-space-xs">
          <div>
            <span className="font-display text-label-sm text-outline">Size M chuẩn</span>
            <p className="flex items-baseline gap-space-xs">
              <span className="font-display text-headline-md text-primary font-bold">{formatCurrency(product.basePrice)}</span>
              {product.originalPrice && (
                <span className="text-body-sm line-through text-outline">{formatCurrency(product.originalPrice)}</span>
              )}
            </p>
          </div>
          <span className="text-body-sm text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full">
            L +{formatCurrency(SIZE_L_EXTRA)}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-space-xs pt-1">
          <button
            type="button"
            disabled={!product.isAvailable}
            onClick={() => onCustomize(product)}
            className="col-span-2 py-2 px-space-xs rounded-full bg-surface-container text-on-surface font-display text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Tùy chỉnh
          </button>
          <button
            type="button"
            disabled={!product.isAvailable}
            onClick={() => onQuickAdd(product)}
            aria-label={`Thêm ${product.name} vào giỏ`}
            className="col-span-3 py-2 px-space-sm rounded-full bg-primary text-on-primary font-display text-label-md hover:bg-primary-container active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-outline disabled:active:scale-100"
          >
            <Plus className="w-4 h-4" />
            {product.isAvailable ? 'Thêm vào giỏ' : 'Tạm hết'}
          </button>
        </div>
      </div>
    </article>
  );
};
