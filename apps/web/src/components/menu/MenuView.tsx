'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Frown } from 'lucide-react';
import { MENU_CATEGORIES } from '../../data/menu-categories';
import { DEFAULT_CUSTOMIZATION, MAX_TOPPINGS } from '../../data/menu-options';
import { CategoryFilter, countByCategory, filterAndSortProducts } from '../../lib/menu-filter';
import { DrinkCustomization, MenuProduct, SortOption } from '../../types/menu';
import { useCart } from '../cart/CartProvider';
import { useFavorites } from '../favorites/FavoritesProvider';
import { useToast } from '../ui/ToastProvider';
import { CategoryTabs } from './CategoryTabs';
import { CustomizeModal } from './CustomizeModal';
import { MenuFeatures } from './MenuFeatures';
import { MenuHero } from './MenuHero';
import { MenuProductCard } from './MenuProductCard';

interface MenuViewProps {
  products: MenuProduct[];
  initialSearch?: string;
  initialCategory?: CategoryFilter;
}

export const MenuView: React.FC<MenuViewProps> = ({ products, initialSearch = '', initialCategory = 'all' }) => {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortOption>('default');
  const { isFavorite, toggleFavorite: toggleFavoriteId } = useFavorites();
  const [customizing, setCustomizing] = useState<MenuProduct | null>(null);

  // Đồng bộ khi người dùng tìm từ ô search trên Header (thay đổi ?q=).
  useEffect(() => setSearch(initialSearch), [initialSearch]);
  useEffect(() => setCategory(initialCategory), [initialCategory]);

  const visibleProducts = useMemo(
    () => filterAndSortProducts(products, { category, search, sort }),
    [products, category, search, sort],
  );
  const counts = useMemo(() => countByCategory(products), [products]);

  const heading =
    category === 'all' ? 'Tất cả món nước' : MENU_CATEGORIES.find((c) => c.id === category)?.label ?? 'Món nước';

  const resetFilters = () => {
    setCategory('all');
    setSearch('');
  };

  const toggleFavorite = (product: MenuProduct) => {
    if (toggleFavoriteId(product.id)) {
      showToast('Đã lưu món vào danh sách Yêu Thích ♥');
    }
  };

  const addToCart = (product: MenuProduct, customization: DrinkCustomization, quantity: number) => {
    addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: product.basePrice,
      customization,
      quantity,
    });
    showToast(`Đã thêm ${quantity}x ${product.name} vào giỏ!`);
  };

  const closeModal = useCallback(() => setCustomizing(null), []);

  return (
    <div className="flex flex-col w-full">
      <MenuHero search={search} sort={sort} onSearchChange={setSearch} onSortChange={setSort} />

      <CategoryTabs active={category} counts={counts} total={products.length} onChange={setCategory} />

      <section className="w-full py-space-xl">
        <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg">
          <div className="flex items-center justify-between mb-space-lg">
            <div className="flex items-center gap-space-xs">
              <h2 className="font-display text-headline-sm text-on-surface">{heading}</h2>
              <span
                data-testid="count-badge"
                className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-display text-label-sm"
              >
                {visibleProducts.length} món
              </span>
            </div>
            <div className="text-body-sm text-outline hidden sm:block">
              Miễn phí đổi đá/đường • Topping thủ công mỗi sáng
            </div>
          </div>

          {visibleProducts.length > 0 ? (
            <div data-testid="menu-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter md:gap-gutter-lg">
              {visibleProducts.map((product) => (
                <MenuProductCard
                  key={product.id}
                  product={product}
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={toggleFavorite}
                  onCustomize={setCustomizing}
                  onQuickAdd={(p) => addToCart(p, DEFAULT_CUSTOMIZATION, 1)}
                />
              ))}
            </div>
          ) : (
            <div data-testid="menu-empty" className="flex flex-col items-center justify-center py-space-xl text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline mb-space-sm">
                <Frown className="w-8 h-8" />
              </div>
              <h4 className="font-display text-headline-sm text-on-surface mb-1">Không tìm thấy món phù hợp</h4>
              <p className="text-body-md text-outline mb-space-md">
                Hãy thử tìm theo tên khác hoặc chọn lại phân loại danh mục.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-space-md py-space-xs rounded-full bg-primary text-on-primary font-display text-label-md"
              >
                Xem tất cả {products.length} món
              </button>
            </div>
          )}
        </div>
      </section>

      <MenuFeatures />

      <CustomizeModal
        product={customizing}
        onClose={closeModal}
        onConfirm={(product, customization, quantity) => {
          addToCart(product, customization, quantity);
          closeModal();
        }}
        onToppingLimit={() => showToast(`Chỉ được chọn tối đa ${MAX_TOPPINGS} loại topping!`)}
      />
    </div>
  );
};
