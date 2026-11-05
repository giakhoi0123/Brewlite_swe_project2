'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProductDetailFromApi, ProductApiError } from '../../services/product-api';
import { ProductDetail } from '../../types/product';
import { DrinkCustomization } from '../../types/menu';
import { DEFAULT_CUSTOMIZATION } from '../../data/menu-options';
import { calcUnitPrice } from '../../lib/pricing';
import { formatCurrency } from '../../utils/format';
import { useCart } from '../cart/CartProvider';
import { useFavorites } from '../favorites/FavoritesProvider';
import { useToast } from '../ui/ToastProvider';
import { ProductGallery } from './ProductGallery';

export function ApiProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProductApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setProduct(null);
    fetchProductDetailFromApi(id, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProduct(data); })
      .catch((err: ProductApiError) => { if (!controller.signal.aborted) setError(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  return <div className="max-w-[1200px] mx-auto w-full px-margin md:px-margin-lg py-space-lg">
    <nav aria-label="Breadcrumb" className="mb-6"><Link href="/thuc-don" className="text-secondary underline">Thực đơn</Link>{product && ` / ${product.name}`}</nav>
    {loading ? <div role="status" className="animate-pulse rounded-xl bg-surface-container p-12">Đang tải thông tin món...</div>
      : error ? <div role="alert" className="text-center py-12">
        <h1 className="font-display text-headline-sm">{error.statusCode === 404 || error.statusCode === 400 ? 'Không tìm thấy món' : 'Không thể tải thông tin món'}</h1>
        <p className="mt-3">{error.message}</p>
        <button className="mt-4 px-6 py-3 rounded-full bg-primary text-on-primary" onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
      </div> : product && <ProductContent key={product.id} product={product} />}
  </div>;
}

function ProductContent({ product }: { product: ProductDetail }) {
  const sizes = product.options.filter((o) => o.type === 'SIZE');
  const toppings = product.options.filter((o) => o.type === 'TOPPING');
  const [customization, setCustomization] = useState<DrinkCustomization>({
    ...DEFAULT_CUSTOMIZATION, size: sizes[0]?.id ?? '', toppingIds: [],
  });
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const stock = product.inventory?.availableStock ?? 0;
  const available = product.isAvailable && product.canOrder !== false && stock > 0;
  const total = calcUnitPrice(product.basePrice, customization, product.options) * quantity;
  const add = (buyNow: boolean) => {
    if (!available || quantity > stock) return;
    addItem({ productId: product.id, name: product.name, imageUrl: product.imageUrl,
      basePrice: product.basePrice, productOptions: product.options, customization, quantity });
    showToast(`Đã thêm ${quantity}x ${product.name} vào giỏ!`);
    if (buyNow) router.push('/gio-hang');
  };

  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg items-start">
    <ProductGallery name={product.name} images={[product.imageUrl]} badges={[available ? 'Còn món' : 'Tạm hết món']} tags={[]}
      isAvailable={available} isFavorite={isFavorite(product.id)} onToggleFavorite={() => toggleFavorite(product.id)} />
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-6">
      <h1 className="font-display text-headline-display-mobile font-bold">{product.name}</h1>
      <p className="text-primary text-headline-lg font-bold">{formatCurrency(product.basePrice)}</p>
      <p>{available ? `Còn ${stock} ly có thể đặt` : 'Món hiện không thể đặt.'}</p>
      {sizes.length > 0 && <fieldset>
        <legend className="font-bold mb-3">Chọn kích thước</legend>
        <div className="flex flex-wrap gap-3">{sizes.map((size) => <button key={size.id} type="button" aria-pressed={customization.size === size.id}
          onClick={() => setCustomization({ ...customization, size: size.id })}
          className={`rounded-xl px-5 py-3 ${customization.size === size.id ? 'bg-primary text-on-primary' : 'bg-surface-container'}`}>
          {size.name} (+{formatCurrency(size.extraPrice)})
        </button>)}</div>
      </fieldset>}
      {toppings.length > 0 && <fieldset>
        <legend className="font-bold mb-3">Thêm topping</legend>
        <div className="flex flex-col gap-3">{toppings.map((topping) => <label key={topping.id} className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
          <input type="checkbox" checked={customization.toppingIds.includes(topping.id)} onChange={(event) => setCustomization({ ...customization,
            toppingIds: event.target.checked ? [...customization.toppingIds, topping.id] : customization.toppingIds.filter((id) => id !== topping.id) })} />
          {topping.name} (+{formatCurrency(topping.extraPrice)})
        </label>)}</div>
      </fieldset>}
      <label className="flex flex-col gap-2">Ghi chú
        <input value={customization.note ?? ''} maxLength={120} onChange={(e) => setCustomization({ ...customization, note: e.target.value })}
          className="rounded-full px-4 py-3 bg-surface-container" placeholder="Ghi chú cho món của bạn" />
      </label>
      <label className="flex items-center justify-between gap-3">Số lượng
        <input aria-label="Số lượng" type="number" min={1} max={Math.max(1, Math.min(99, stock))} disabled={!available} value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(99, stock, Math.floor(Number(e.target.value) || 1))))}
          className="w-24 rounded-full px-4 py-2 bg-surface-container" />
      </label>
      <p className="font-bold text-headline-sm">Tổng: <span data-testid="api-detail-total">{formatCurrency(total)}</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button disabled={!available} onClick={() => add(false)} className="rounded-full px-5 py-3 bg-primary text-on-primary disabled:opacity-40">Thêm vào giỏ hàng</button>
        <button disabled={!available} onClick={() => add(true)} className="rounded-full px-5 py-3 bg-secondary text-on-secondary disabled:opacity-40">Mua ngay</button>
      </div>
    </div>
  </div>;
}
