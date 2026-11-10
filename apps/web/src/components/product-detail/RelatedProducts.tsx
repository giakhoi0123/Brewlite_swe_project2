import Link from 'next/link';
import { ArrowRight, Plus, Star } from 'lucide-react';
import { MenuProduct } from '../../types/menu';
import { formatCurrency } from '../../utils/format';

interface RelatedProductsProps {
  products: MenuProduct[];
  onQuickAdd: (product: MenuProduct) => void;
}

export const RelatedProducts: React.FC<RelatedProductsProps> = ({ products, onQuickAdd }) => (
  <section className="max-w-[1200px] mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg pb-space-xl">
    <div className="flex flex-col gap-space-md">
      <div className="flex items-end justify-between">
        <div>
          <span className="font-display text-label-md text-secondary uppercase tracking-widest font-bold">
            Thực đơn chọn lọc
          </span>
          <h2 className="font-display text-headline-lg font-extrabold tracking-tight text-on-surface">Có thể bạn sẽ thích</h2>
        </div>
        <Link
          href="/products"
          className="hidden sm:flex items-center gap-1 font-display text-label-md font-bold text-secondary hover:text-on-surface transition-colors"
        >
          Xem tất cả <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {products.map((product) => (
          <article
            key={product.id}
            data-testid={`related-${product.id}`}
            className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <Link href={`/products/${product.slug}`} className="relative block w-full aspect-square bg-surface-container overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {product.badge && (
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-surface/90 backdrop-blur-md text-on-surface font-display text-label-sm">
                  {product.badge.label}
                </span>
              )}
            </Link>
            <div className="p-space-md flex flex-col gap-space-xs flex-grow justify-between">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-3.5 h-3.5 text-[#d97706]" fill="currentColor" />
                  <span className="font-display text-label-sm font-bold text-on-surface">{product.rating.toFixed(1)}</span>
                  <span className="font-display text-label-sm text-on-surface-variant">({product.reviewCount})</span>
                </div>
                <h3 className="font-display text-label-lg font-bold text-on-surface group-hover:text-secondary transition-colors">
                  <Link href={`/products/${product.slug}`}>{product.name}</Link>
                </h3>
                <p className="text-body-sm text-on-surface-variant line-clamp-1">{product.description}</p>
              </div>
              <div className="flex items-center justify-between pt-space-xs mt-2">
                <span className="font-display text-headline-sm font-extrabold text-primary-container">
                  {formatCurrency(product.basePrice)}
                </span>
                <button
                  type="button"
                  onClick={() => onQuickAdd(product)}
                  aria-label={`Thêm nhanh ${product.name}`}
                  className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface font-display text-label-sm font-bold hover:bg-primary-container hover:text-on-primary transition-all flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Thêm nhanh
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
