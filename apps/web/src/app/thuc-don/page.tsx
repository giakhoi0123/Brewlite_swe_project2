import type { Metadata } from 'next';
import { MenuView } from '../../components/menu/MenuView';
import { getCategory } from '../../data/menu-categories';
import { MOCK_PRODUCTS } from '../../data/menu-products';
import { CategoryFilter } from '../../lib/menu-filter';

export const metadata: Metadata = {
  title: 'Thực đơn — BrewLite',
  description: 'Thực đơn đồ uống BrewLite: cà phê rang mộc, trà trái cây, trà sữa và thức uống giải nhiệt.',
};

interface MenuPageProps {
  searchParams: { q?: string; 'danh-muc'?: string };
}

export default function MenuPage({ searchParams }: MenuPageProps) {
  const categoryParam = searchParams['danh-muc'];
  const initialCategory: CategoryFilter = (categoryParam && getCategory(categoryParam)?.id) || 'all';

  // TODO: thay MOCK_PRODUCTS bằng dữ liệu từ API /products khi backend có đủ category, mô tả, rating.
  return <MenuView products={MOCK_PRODUCTS} initialSearch={searchParams.q ?? ''} initialCategory={initialCategory} />;
}
