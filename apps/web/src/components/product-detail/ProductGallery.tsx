'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { ProductTag } from '../../types/menu';
import { ICONS } from '../ui/icon-map';

interface ProductGalleryProps {
  name: string;
  images: string[];
  badges: string[];
  tags: ProductTag[];
  isFavorite: boolean;
  isAvailable: boolean;
  onToggleFavorite: () => void;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  name,
  images,
  badges,
  tags,
  isFavorite,
  isAvailable,
  onToggleFavorite,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col gap-space-md">
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-surface-container shadow-md group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[activeIndex]}
          alt={name}
          data-testid="gallery-main-image"
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            isAvailable ? '' : 'grayscale'
          }`}
        />
        <div className="absolute top-4 left-4 flex flex-wrap gap-space-xs">
          {badges.map((badge, i) => (
            <span
              key={badge}
              className={`px-3 py-1 rounded-full font-display text-label-sm shadow-sm ${
                i === 0
                  ? 'bg-secondary text-on-secondary uppercase tracking-wider'
                  : 'bg-surface-container-lowest/90 backdrop-blur-md text-on-surface'
              }`}
            >
              {badge}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
          className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center transition-all shadow-sm ${
            isFavorite ? 'text-error' : 'text-on-surface hover:text-secondary'
          }`}
        >
          <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-space-sm">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`Xem ảnh ${i + 1}`}
            aria-current={i === activeIndex}
            className={`relative aspect-square rounded-lg overflow-hidden bg-surface-container transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              i === activeIndex ? 'ring-2 ring-secondary shadow-sm' : 'opacity-70 hover:opacity-100'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-space-xs flex-wrap pt-space-xs">
        {tags.map((tag) => {
          const Icon = ICONS[tag.icon];
          return (
            <span
              key={tag.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-display text-label-md"
            >
              <Icon className="w-4 h-4 text-secondary" />
              {tag.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
