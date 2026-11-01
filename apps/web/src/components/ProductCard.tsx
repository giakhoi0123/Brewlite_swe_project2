'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product } from '../types/product';
import { formatCurrency } from '../utils/format';
import { Coffee } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80';

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || FALLBACK_IMAGE);
  const [hasImageError, setHasImageError] = useState(false);

  const handleImageError = () => {
    if (!hasImageError) {
      setHasImageError(true);
      setImgSrc(FALLBACK_IMAGE);
    }
  };

  const hasActionHandler = typeof onClick === 'function';

  return (
    <article
      data-testid={`product-card-${product.id}`}
      aria-label={`Sản phẩm: ${product.name}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        product.isAvailable
          ? 'bg-white border-stone-200 shadow-sm hover:shadow-md hover:border-brew-300'
          : 'bg-stone-50 border-stone-200 opacity-75'
      }`}
    >
      {/* Product Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          onError={handleImageError}
          className={`h-full w-full object-cover transition-transform duration-300 ${
            product.isAvailable ? 'group-hover:scale-105' : 'grayscale'
          }`}
        />

        {/* Availability Badge */}
        <div className="absolute top-2.5 right-2.5">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm shadow-sm ${
              product.isAvailable
                ? 'bg-emerald-500/90 text-white'
                : 'bg-stone-700/80 text-stone-100'
            }`}
          >
            {product.isAvailable ? 'Còn hàng' : 'Hết hàng'}
          </span>
        </div>
      </div>

      {/* Product Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3
            className="text-base font-bold text-stone-800 line-clamp-2 leading-snug tracking-tight"
            title={product.name}
          >
            {product.name}
          </h3>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-stone-100">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Giá từ
            </span>
            <span className="text-base font-extrabold text-brew-800">
              {formatCurrency(product.basePrice)}
            </span>
          </div>

          {/* Chỉ hiển thị nút CTA khi thực sự có handler được truyền vào */}
          {hasActionHandler && (
            <button
              type="button"
              disabled={!product.isAvailable}
              onClick={() => onClick(product)}
              aria-label={product.isAvailable ? `Chọn mua ${product.name}` : `${product.name} hiện đã hết`}
              className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brew-500 focus:ring-offset-1 ${
                product.isAvailable
                  ? 'bg-brew-700 text-white hover:bg-brew-800 active:bg-brew-900 shadow-sm'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 mr-1.5" />
              {product.isAvailable ? 'Chọn món' : 'Tạm hết'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
