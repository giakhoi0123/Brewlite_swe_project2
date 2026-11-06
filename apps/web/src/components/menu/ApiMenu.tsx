'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchProductsFromApi } from '../../services/product-api';
import { normalizeSearchText } from '../../lib/menu-filter';
import { Product } from '../../types/product';
import { SortOption } from '../../types/menu';
import { formatCurrency } from '../../utils/format';
import { useFavorites } from '../favorites/FavoritesProvider';
import { MenuHero } from './MenuHero';

export function ApiMenu({ initialSearch = '' }: { initialSearch?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortOption>('default');
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => setSearch(initialSearch), [initialSearch]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchProductsFromApi(undefined, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProducts(data); })
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const visible = useMemo(() => {
    const query = normalizeSearchText(search);
    const result = products.filter((p) => normalizeSearchText(p.name).includes(query));
    if (sort === 'price-asc') result.sort((a, b) => a.basePrice - b.basePrice);
    if (sort === 'price-desc') result.sort((a, b) => b.basePrice - a.basePrice);
    return result;
  }, [products, search, sort]);

  return <div className="w-full">
    <MenuHero search={search} sort={sort} onSearchChange={setSearch} onSortChange={setSort} liveData />
    <section aria-label="Danh sách đồ uống" className="max-w-[1200px] mx-auto px-margin md:px-margin-lg py-space-lg">
      {loading ? <div role="status" className="animate-pulse">
        <p>Đang tải thực đơn...</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter mt-4">
          {[0, 1, 2].map((n) => <div key={n} className="h-80 rounded-xl bg-surface-container" />)}
        </div>
      </div> : error ? <div role="alert" className="text-center py-12">
        <p>{error}</p>
        <button className="mt-4 px-6 py-3 rounded-full bg-primary text-on-primary" onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
      </div> : <>
        <h2 className="font-display text-headline-sm mb-6">Tất cả món nước ({visible.length})</h2>
        {visible.length === 0 ? <div className="text-center py-12">
          <p>{products.length ? 'Không tìm thấy món phù hợp.' : 'Thực đơn hiện chưa có sản phẩm.'}</p>
          {search && <button className="mt-4 text-secondary underline" onClick={() => setSearch('')}>Xóa tìm kiếm</button>}
        </div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter md:gap-gutter-lg">
          {visible.map((product) => {
            const available = product.isAvailable && product.canOrder !== false;
            return <article key={product.id} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3">
              <Link href={`/products/${product.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt={product.name} className="w-full h-56 object-cover rounded-lg bg-surface-container" />
              </Link>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-headline-sm"><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
                <button aria-label={`Yêu thích ${product.name}`} aria-pressed={isFavorite(product.id)} onClick={() => toggleFavorite(product.id)} className="text-secondary text-xl">{isFavorite(product.id) ? '♥' : '♡'}</button>
              </div>
              <p className="text-primary font-bold text-headline-sm">{formatCurrency(product.basePrice)}</p>
              <p className="text-body-sm text-on-surface-variant">{available ? 'Còn món' : 'Tạm hết món'}</p>
              <Link href={`/products/${product.id}`} className="mt-auto text-center py-3 rounded-full bg-primary text-on-primary">{available ? 'Chọn món' : 'Xem chi tiết'}</Link>
            </article>;
          })}
        </div>}
      </>}
    </section>
  </div>;
}
