'use client';

import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  checkCartAvailability,
  fetchProductDetailFromApi,
  ProductApiError,
  AvailabilityResult,
  AvailabilityItemResult,
} from '../../services/product-api';
import { ProductDetail } from '../../types/product';
import { DrinkCustomization } from '../../types/menu';
import { DEFAULT_CUSTOMIZATION } from '../../data/menu-options';
import { calcUnitPrice } from '../../lib/pricing';
import { formatCurrency } from '../../utils/format';
import { useCart } from '../cart/CartProvider';
import { useFavorites } from '../favorites/FavoritesProvider';
import { useToast } from '../ui/ToastProvider';
import { ProductGallery } from './ProductGallery';

// Trần số ly cho một món trong một lần đặt, độc lập với tồn kho nguyên liệu.
const MAX_QUANTITY_PER_ORDER = 99;

export function computeProductBadge({
  isAvailable,
  isSizeSelected,
  isLoading,
  error,
  availabilityResult,
  previewAvailability,
}: {
  isAvailable: boolean;
  isSizeSelected: boolean;
  isLoading: boolean;
  error: Error | null;
  availabilityResult: AvailabilityResult | null;
  previewAvailability: AvailabilityItemResult | null;
}): string {
  // 1. product.isAvailable === false: Tạm ngừng bán (ưu tiên hàng đầu)
  if (!isAvailable) {
    return 'Tạm ngừng bán';
  }

  // 2. Chưa chọn SIZE: Trạng thái trung lập
  if (!isSizeSelected) {
    return 'Chọn kích cỡ';
  }

  // 3. Đang gửi request kiểm tra
  if (isLoading) {
    return 'Đang kiểm tra';
  }

  // 4. Có lỗi request hoặc không tìm thấy preview availability trong response
  if (error !== null || (availabilityResult !== null && previewAvailability === null)) {
    return 'Chưa xác định';
  }

  // 5. Availability thành công
  if (availabilityResult && previewAvailability) {
    if (
      availabilityResult.canOrder &&
      previewAvailability.canOrder &&
      previewAvailability.availableQuantity > 0
    ) {
      return 'Còn món';
    }
    return 'Tạm hết món';
  }

  return 'Chưa xác định';
}

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
      .then((data) => {
        if (!controller.signal.aborted) setProduct(data);
      })
      .catch((err: ProductApiError) => {
        if (!controller.signal.aborted) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <div className="max-w-[1200px] mx-auto w-full px-margin md:px-margin-lg py-space-lg">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/products" className="text-secondary underline">
          Thực đơn
        </Link>
        {product && ` / ${product.name}`}
      </nav>
      {loading ? (
        <div
          role="status"
          className="animate-pulse rounded-xl bg-surface-container p-12"
        >
          Đang tải thông tin món...
        </div>
      ) : error ? (
        <div role="alert" className="text-center py-12">
          <h1 className="font-display text-headline-sm">
            {error.statusCode === 404 || error.statusCode === 400
              ? 'Không tìm thấy món'
              : 'Không thể tải thông tin món'}
          </h1>
          <p className="mt-3">{error.message}</p>
          <button
            className="mt-4 px-6 py-3 rounded-full bg-primary text-on-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : (
        product && <ProductContent key={product.id} product={product} />
      )}
    </div>
  );
}

function ProductContent({ product }: { product: ProductDetail }) {
  const sizes = product.options.filter((o) => o.type === 'SIZE');
  const toppings = product.options.filter((o) => o.type === 'TOPPING');
  const [customization, setCustomization] = useState<DrinkCustomization>({
    ...DEFAULT_CUSTOMIZATION,
    size: sizes[0]?.id ?? '',
    toppingIds: [],
  });
  const [quantity, setQuantity] = useState(1);
  const [quantityAdjustNotice, setQuantityAdjustNotice] = useState<string | null>(null);

  // Availability state (Cart-aware)
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityResult | null>(null);
  const [previewAvailability, setPreviewAvailability] = useState<AvailabilityItemResult | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<ProductApiError | null>(null);
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);

  const { addItem, items, isChecking } = useCart();
  const { showToast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();

  useEffect(() => {
    // 
    if (!customization.size) {
      setAvailabilityResult(null);
      setPreviewAvailability(null);
      setAvailabilityLoading(false);
      setAvailabilityError(null);
      return;
    }

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError(null);


    const previewItems = [
      ...items,
      {
        productId: product.id,
        customization,
        quantity,
      },
    ];

    const previewIndex = previewItems.length - 1;

    checkCartAvailability(previewItems, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setAvailabilityResult(res);
          const found = res.items.find((it) => it.index === previewIndex);
          if (found) {
            setPreviewAvailability(found);
          } else {
            setPreviewAvailability(null);
            setAvailabilityError(
              new ProductApiError('Không tìm thấy thông tin tồn kho cho món này', 500),
            );
          }
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setAvailabilityResult(null);
          setPreviewAvailability(null);
          setAvailabilityError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    product.id,
    customization.size,
    customization.toppingIds,
    quantity,
    items,
    availabilityAttempt,
  ]);


  useEffect(() => {
    if (!previewAvailability) return;
    const stock = previewAvailability.availableQuantity;
    if (stock > 0 && quantity > stock) {
      setQuantity(stock);
      setQuantityAdjustNotice('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.');
      showToast(`Nguyên liệu chỉ đủ cho tối đa ${stock} ly với lựa chọn này.`, 'error');
    }
  }, [previewAvailability, quantity, showToast]);

  const isSizeSelected = Boolean(customization.size && customization.size.trim().length > 0);

  const isAvailabilityReady =
    isSizeSelected &&
    !availabilityLoading &&
    availabilityError === null &&
    availabilityResult !== null &&
    previewAvailability !== null;

  const canAddToCart = Boolean(
    product &&
    product.isAvailable &&
    isSizeSelected &&
    isAvailabilityReady &&
    previewAvailability &&
    previewAvailability.canOrder === true &&
    previewAvailability.availableQuantity > 0 &&
    availabilityResult &&
    availabilityResult.canOrder === true &&
    quantity >= 1 &&
    quantity <= previewAvailability.availableQuantity &&
    !isChecking,
  );

  const total = calcUnitPrice(product.basePrice, customization, product.options) * quantity;


  const maxQuantity =
    previewAvailability && previewAvailability.availableQuantity > 0
      ? Math.min(MAX_QUANTITY_PER_ORDER, previewAvailability.availableQuantity)
      : 1;

  const isLimitedByOrderCap =
    (previewAvailability?.availableQuantity ?? 0) > MAX_QUANTITY_PER_ORDER;
  const isQuantityLocked =
    !isAvailabilityReady || (previewAvailability?.availableQuantity ?? 0) === 0;
  const isAtMaxQuantity = isAvailabilityReady && !isQuantityLocked && quantity >= maxQuantity;

  const notifyOverLimit = () => {
    showToast(
      isLimitedByOrderCap
        ? `Mỗi lần chỉ đặt được tối đa ${MAX_QUANTITY_PER_ORDER} ly cho một món.`
        : `Chỉ còn đủ nguyên liệu cho tối đa ${maxQuantity} ly. Không thể thêm nhiều hơn.`,
      'error',
    );
  };

  const changeQuantity = (next: number) => {
    setQuantityAdjustNotice(null);
    if (next > maxQuantity) {
      setQuantity(maxQuantity);
      notifyOverLimit();
      return;
    }
    setQuantity(Math.max(1, next));
  };

  const add = async (buyNow: boolean) => {
    if (!canAddToCart) return;
    const added = await addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: product.basePrice,
      productOptions: product.options,
      customization,
      quantity,
    });
    // Khi thất bại, CartProvider đã hiện popup stockError ghi rõ món và số ly tối đa.
    if (!added) return;
    showToast(`Đã thêm ${quantity}x ${product.name} vào giỏ!`);
    if (buyNow) router.push('/gio-hang');
  };

  const renderAvailabilityStatus = () => {
    if (!product.isAvailable) {
      return <p className="text-error font-medium">Món hiện không thể đặt.</p>;
    }

    if (!isSizeSelected) {
      return (
        <p className="text-secondary font-medium">
          Chọn kích cỡ để xem số lượng có thể đặt
        </p>
      );
    }

    if (availabilityLoading) {
      return (
        <p role="status" className="text-on-surface-variant animate-pulse font-medium">
          Đang kiểm tra nguyên liệu...
        </p>
      );
    }

    if (availabilityError || (availabilityResult && !previewAvailability)) {
      return (
        <div role="alert" className="flex items-center gap-3 text-error">
          <span className="font-medium">
            {availabilityError?.message || 'Không thể kiểm tra nguyên liệu. Vui lòng thử lại.'}
          </span>
          <button
            type="button"
            onClick={() => setAvailabilityAttempt((n) => n + 1)}
            className="text-primary underline font-medium text-body-sm"
          >
            Thử lại
          </button>
        </div>
      );
    }

    if (availabilityResult && previewAvailability) {
      if (
        previewAvailability.availableQuantity === 0 ||
        !previewAvailability.canOrder ||
        !availabilityResult.canOrder
      ) {
        return <p className="text-error font-medium">Món hiện không đủ nguyên liệu</p>;
      }
      return (
        <p className="text-on-surface-variant font-medium">
          Còn tối đa {previewAvailability.availableQuantity} ly
        </p>
      );
    }

    return null;
  };

  const badgeLabel = computeProductBadge({
    isAvailable: product.isAvailable,
    isSizeSelected,
    isLoading: availabilityLoading,
    error: availabilityError,
    availabilityResult,
    previewAvailability,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg items-start">
      <ProductGallery
        name={product.name}
        images={[product.imageUrl]}
        badges={[badgeLabel]}
        tags={[]}
        isAvailable={product.isAvailable}
        isFavorite={isFavorite(product.id)}
        onToggleFavorite={() => toggleFavorite(product.id)}
      />
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-6">
        <h1 className="font-display text-headline-display-mobile font-bold">{product.name}</h1>
        <p className="text-primary text-headline-lg font-bold">{formatCurrency(product.basePrice)}</p>
        {renderAvailabilityStatus()}
        {quantityAdjustNotice && (
          <p role="status" className="text-secondary text-body-sm bg-surface-container p-2 rounded-lg">
            {quantityAdjustNotice}
          </p>
        )}
        {sizes.length > 0 && (
          <fieldset>
            <legend className="font-bold mb-3">Chọn kích thước</legend>
            <div className="flex flex-wrap gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  aria-pressed={customization.size === size.id}
                  onClick={() => {
                    setQuantityAdjustNotice(null);
                    setCustomization({
                      ...customization,
                      size: customization.size === size.id ? '' : size.id,
                    });
                  }}
                  className={`rounded-xl px-5 py-3 ${customization.size === size.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container'
                    }`}
                >
                  {size.name} (+{formatCurrency(size.extraPrice)})
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {toppings.length > 0 && (
          <fieldset>
            <legend className="font-bold mb-3">Thêm topping</legend>
            <div className="flex flex-col gap-3">
              {toppings.map((topping) => (
                <label key={topping.id} className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
                  <input
                    type="checkbox"
                    checked={customization.toppingIds.includes(topping.id)}
                    onChange={(event) => {
                      setQuantityAdjustNotice(null);
                      setCustomization({
                        ...customization,
                        toppingIds: event.target.checked
                          ? [...customization.toppingIds, topping.id]
                          : customization.toppingIds.filter((id) => id !== topping.id),
                      });
                    }}
                  />
                  {topping.name} (+{formatCurrency(topping.extraPrice)})
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-2">
          Ghi chú
          <input
            value={customization.note ?? ''}
            maxLength={120}
            onChange={(e) => setCustomization({ ...customization, note: e.target.value })}
            className="rounded-full px-4 py-3 bg-surface-container"
            placeholder="Ghi chú cho món của bạn"
          />
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span id="quantity-label">Số lượng</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={isQuantityLocked || quantity <= 1}
                onClick={() => changeQuantity(quantity - 1)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                aria-label="Số lượng"
                aria-describedby={isAtMaxQuantity ? 'quantity-max-hint' : undefined}
                type="number"
                min={1}
                max={maxQuantity}
                disabled={isQuantityLocked}
                value={quantity}
                onChange={(e) => {
                  const rawValue = e.target.value.trim();
                  const parsed = parseInt(rawValue, 10);
                  if (rawValue === '' || isNaN(parsed) || parsed < 1) {
                    changeQuantity(1);
                    return;
                  }
                  changeQuantity(parsed);
                }}
                className="w-20 text-center rounded-full px-3 py-2 bg-surface-container disabled:opacity-40"
              />
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={isQuantityLocked}
                aria-disabled={isAtMaxQuantity}
                onClick={() => {
                  // Đã chạm mức tối đa: khóa tăng và hiện popup thay vì im lặng.
                  if (isAtMaxQuantity) {
                    notifyOverLimit();
                    return;
                  }
                  changeQuantity(quantity + 1);
                }}
                className={`w-9 h-9 rounded-full bg-surface-container flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${isAtMaxQuantity ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {isAtMaxQuantity && (
            <p id="quantity-max-hint" className="text-secondary text-body-sm text-right">
              {isLimitedByOrderCap
                ? `Tối đa ${MAX_QUANTITY_PER_ORDER} ly mỗi lần đặt`
                : `Đã đạt số lượng tối đa (${maxQuantity} ly)`}
            </p>
          )}
        </div>
        <p className="font-bold text-headline-sm">
          Tổng: <span data-testid="api-detail-total">{formatCurrency(total)}</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            disabled={!canAddToCart}
            onClick={() => add(false)}
            className="rounded-full px-5 py-3 bg-primary text-on-primary disabled:opacity-40"
          >
            Thêm vào giỏ hàng
          </button>
          <button
            disabled={!canAddToCart}
            onClick={() => add(true)}
            className="rounded-full px-5 py-3 bg-secondary text-on-secondary disabled:opacity-40"
          >
            Mua ngay
          </button>
        </div>
      </div>
    </div>
  );
}
