'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, Trash, Trash2, Truck, TriangleAlert } from 'lucide-react';
import { MOCK_PRODUCTS } from '../../data/menu-products';
import { computeCartSummary } from '../../lib/cart-summary';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { CartLineItem } from './CartLineItem';
import { useCart } from './CartProvider';
import { EmptyCart } from './EmptyCart';
import { OrderSummary } from './OrderSummary';

const PRODUCTS_BY_ID = new Map(MOCK_PRODUCTS.map((p) => [p.id, p]));

type PendingDelete = { kind: 'line'; lineId: string; name: string } | { kind: 'all' } | null;

export const CartView: React.FC = () => {
  const { isReady, isChecking, canCheckout, items, voucherCode, updateQuantity, updateSize, removeItem, clearCart, setVoucherCode } = useCart();
  const { showToast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const summary = useMemo(() => computeCartSummary(items, voucherCode), [items, voucherCode]);
  const closeDialog = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'all') {
      clearCart();
      showToast('Đã làm trống giỏ hàng');
    } else {
      removeItem(pendingDelete.lineId);
      showToast(`Đã xóa ${pendingDelete.name} khỏi giỏ`);
    }
    setPendingDelete(null);
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-md lg:py-space-lg">
      <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs text-on-surface-variant font-display text-label-md mb-space-md">
        <Link href="/" className="hover:text-secondary transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/products" className="hover:text-secondary transition-colors">
          Thực đơn
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-on-surface font-bold" aria-current="page">
          Giỏ hàng của bạn
        </span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm pb-space-lg">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-display text-headline-display-mobile md:text-headline-display text-on-surface tracking-tight">
              Giỏ hàng của bạn
            </h1>
            {isReady && summary.itemCount > 0 && (
              <span
                data-testid="cart-count-badge"
                className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-display text-label-md"
              >
                {summary.itemCount} sản phẩm
              </span>
            )}
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">Cà phê rang mộc thủ công, pha chế ngay khi nhận đơn.</p>
        </div>
        {isReady && items.length > 0 && (
          <button
            type="button"
            onClick={() => setPendingDelete({ kind: 'all' })}
            className="group self-start md:self-auto flex items-center gap-space-xs px-space-md py-2 rounded-full bg-surface-container hover:bg-error-container text-on-surface-variant hover:text-error transition-all shadow-sm"
          >
            <Trash className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
            <span className="font-display text-label-md">Xóa tất cả</span>
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="mb-4 min-h-6 text-secondary">{isChecking ? 'Đang kiểm tra nguyên liệu cho giỏ hàng...' : ''}</p>
      {!isReady ? (
        <div data-testid="cart-loading" className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg animate-pulse">
          <div className="lg:col-span-8 flex flex-col gap-space-md">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-container" />
            ))}
          </div>
          <div className="lg:col-span-4 h-96 rounded-xl bg-surface-container" />
        </div>
      ) : items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          <section aria-label="Danh sách món" className="lg:col-span-8 flex flex-col gap-space-md">
            {items.map((item) => (
              <CartLineItem
                key={item.lineId}
                item={item}
                product={PRODUCTS_BY_ID.get(item.productId)}
                onQuantityChange={(quantity) =>
                  quantity <= 0
                    ? setPendingDelete({ kind: 'line', lineId: item.lineId, name: item.name })
                    : updateQuantity(item.lineId, quantity)
                }
                onSizeChange={(size) => updateSize(item.lineId, size)}
                onRemove={() => setPendingDelete({ kind: 'line', lineId: item.lineId, name: item.name })}
              />
            ))}

            <div className="p-space-md rounded-xl bg-surface-container-low flex items-center gap-space-sm text-on-surface-variant">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-body-sm">
                <span className="font-bold text-on-surface">Đóng gói giữ nhiệt &amp; niêm phong chống đổ tràn</span>
                <span>Ly giấy tráng sáp thực vật thân thiện môi trường, đá riêng theo yêu cầu của bạn.</span>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4 lg:sticky lg:top-24">
            <OrderSummary
              summary={summary}
              isChecking={isChecking}
              canCheckout={canCheckout}
              onApplyVoucher={setVoucherCode}
              onRemoveVoucher={() => setVoucherCode(null)}
            />
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete?.kind === 'line'}
        tone="danger"
        icon={TriangleAlert}
        title="Xóa món đồ uống?"
        message={
          pendingDelete?.kind === 'line'
            ? `Bạn có chắc chắn muốn bỏ ly "${pendingDelete.name}" khỏi giỏ hàng không?`
            : ''
        }
        confirmLabel="Xóa món"
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
      <ConfirmDialog
        open={pendingDelete?.kind === 'all'}
        icon={Trash2}
        title="Làm trống giỏ hàng?"
        message="Tất cả đồ uống và tùy chỉnh của bạn trong giỏ sẽ bị xóa bỏ."
        confirmLabel="Xóa tất cả"
        cancelLabel="Giữ lại"
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
    </div>
  );
};
