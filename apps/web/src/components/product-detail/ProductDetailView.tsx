'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { getCategory } from '../../data/menu-categories';
import { DEFAULT_CUSTOMIZATION, MAX_TOPPINGS } from '../../data/menu-options';
import { CATEGORY_DETAILS } from '../../data/product-details';
import { getGalleryImages, getRelatedProducts } from '../../lib/product-detail';
import { DrinkCustomization, MenuProduct } from '../../types/menu';
import { useCart } from '../cart/CartProvider';
import { useFavorites } from '../favorites/FavoritesProvider';
import { useToast } from '../ui/ToastProvider';
import { ProductConfigurator } from './ProductConfigurator';
import { ProductGallery } from './ProductGallery';
import { ProductStory } from './ProductStory';
import { RelatedProducts } from './RelatedProducts';

interface ProductDetailViewProps {
  product: MenuProduct;
  allProducts: MenuProduct[];
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, allProducts }) => {
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();

  const category = getCategory(product.categoryId);
  const detail = CATEGORY_DETAILS[product.categoryId];
  const images = getGalleryImages(product, allProducts);
  const related = getRelatedProducts(product, allProducts);
  const badges = [product.badge?.label, product.isAvailable ? detail.tags[0]?.label : 'Tạm hết món'].filter(
    (b): b is string => Boolean(b),
  );

  const addToCart = (item: MenuProduct, customization: DrinkCustomization, quantity: number) => {
    addItem({
      productId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      basePrice: item.basePrice,
      customization: { ...customization, note: customization.note?.trim() },
      quantity,
    });
    showToast(`Đã thêm ${quantity}x ${item.name} vào giỏ!`);
  };

  return (
    <div className="flex flex-col w-full">
      <section className="max-w-[1200px] mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg pt-space-lg pb-space-sm">
        <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-display text-label-md text-on-surface-variant flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <Home className="w-4 h-4" /> Trang chủ
          </Link>
          <span className="text-outline-variant">/</span>
          <Link href={`/thuc-don?danh-muc=${product.categoryId}`} className="hover:text-primary transition-colors">
            {category?.label}
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-bold" aria-current="page">
            {product.name}
          </span>
        </nav>
      </section>

      <section className="max-w-[1200px] mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg pb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          <div className="lg:col-span-6 lg:sticky lg:top-24">
            <ProductGallery
              name={product.name}
              images={images}
              badges={badges}
              tags={detail.tags}
              isAvailable={product.isAvailable}
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={() => {
                if (toggleFavorite(product.id)) showToast('Đã lưu món vào danh sách Yêu Thích ♥');
              }}
            />
          </div>
          <div className="lg:col-span-6">
            <ProductConfigurator
              product={product}
              series={detail.series}
              onAddToCart={(customization, quantity) => addToCart(product, customization, quantity)}
              onBuyNow={(customization, quantity) => {
                addToCart(product, customization, quantity);
                router.push('/gio-hang');
              }}
              onToppingLimit={() => showToast(`Chỉ được chọn tối đa ${MAX_TOPPINGS} loại topping!`)}
            />
          </div>
        </div>
      </section>

      <ProductStory productName={product.name} story={detail.story} flavor={detail.flavor} />

      <RelatedProducts products={related} onQuickAdd={(item) => addToCart(item, DEFAULT_CUSTOMIZATION, 1)} />
    </div>
  );
};
