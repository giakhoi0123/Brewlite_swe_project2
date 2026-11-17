'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgePercent, ReceiptText, Snowflake, X } from 'lucide-react';
import { CartSummary } from '../../lib/cart-summary';
import { formatCurrency } from '../../utils/format';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://localhost:3005/api');

interface OrderSummaryProps {
  summary: CartSummary;
  isChecking?: boolean;
  canCheckout?: boolean;
  onApplyVoucher: (code: string) => void;
  onRemoveVoucher: () => void;
}

const PERKS = [
  { icon: Snowflake, label: 'Giữ trọn vị' },
  { icon: BadgePercent, label: 'Tích điểm 5%' },
];

export const OrderSummary: React.FC<OrderSummaryProps> = ({ summary, onApplyVoucher, onRemoveVoucher, isChecking = false, canCheckout = true }) => {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Xử lý gọi API Validate xuống NestJS Backend
  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/promotions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          orderAmount: summary.subtotal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
      }

      onApplyVoucher(data.code);
      setMessage({
        ok: true,
        text: `✓ Áp dụng thành công mã ${data.code} — Giảm ${formatCurrency(data.discountAmount)}.`,
      });
      setCode('');
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-space-md lg:p-space-lg rounded-xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(43,24,16,0.06)] flex flex-col gap-space-md">
      <div className="flex items-center justify-between pb-space-xs">
        <h2 className="font-display text-headline-sm font-bold text-on-surface">Tóm tắt đơn hàng</h2>
        <ReceiptText className="w-5 h-5 text-secondary" />
      </div>

      <dl className="flex flex-col gap-space-xs text-body-md">
        <div className="flex items-center justify-between text-on-surface-variant">
          <dt>Tạm tính ({summary.itemCount} ly)</dt>
          <dd data-testid="summary-subtotal" className="font-semibold text-on-surface">
            {formatCurrency(summary.subtotal)}
          </dd>
        </div>

        {summary.voucher && (
          <div className={`flex items-center justify-between gap-2 ${summary.voucherInactive ? 'text-outline' : 'text-secondary'}`}>
            <dt className="flex items-center gap-1 flex-wrap">
              <span>Mã giảm giá</span>
              <span className="inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-display text-label-sm">
                {summary.voucher.code}
                <button
                  type="button"
                  onClick={() => {
                    onRemoveVoucher();
                    setMessage(null);
                  }}
                  aria-label={`Bỏ mã ${summary.voucher.code}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-secondary/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </dt>
            <dd data-testid="summary-discount" className="font-semibold whitespace-nowrap">
              - {formatCurrency(summary.discount)}
            </dd>
          </div>
        )}
        {summary.voucherInactive && summary.voucher && (
          <p className="text-body-sm text-error -mt-1">
            Đơn chưa đủ {formatCurrency(summary.voucher.minSubtotal)} để dùng mã này.
          </p>
        )}

        <div className="h-px bg-surface-container-high my-space-xs" />

        <div className="flex items-baseline justify-between gap-space-sm pt-1">
          <dt className="flex flex-col">
            <span className="font-display text-headline-sm font-bold text-on-surface">Tổng cộng</span>
          </dt>
          <dd data-testid="summary-total" className="font-display text-headline-lg font-extrabold text-primary-container tracking-tight text-right">
            {formatCurrency(summary.total)}
          </dd>
        </div>
      </dl>

      <form onSubmit={handleApply} className="flex flex-col gap-space-xs pt-1">
        <label htmlFor="voucher-input" className="font-display text-label-md font-bold text-on-surface">
          Mã ưu đãi / Voucher
        </label>
        <div className="relative flex items-center">
          <input
            id="voucher-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Nhập mã (VD: COFFEE10)"
            className="w-full pl-3.5 pr-24 py-2.5 rounded-full bg-surface-container-low text-on-surface placeholder:text-outline text-body-sm uppercase placeholder:normal-case focus:outline-none focus:bg-surface-container transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 px-space-md py-1.5 rounded-full bg-primary-container text-on-primary font-display text-label-md font-bold hover:bg-primary active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Đang check...' : 'Áp dụng'}
          </button>
        </div>
        {message && (
          <p role="status" className={`text-body-sm px-2 pt-0.5 ${message.ok ? 'text-secondary font-semibold' : 'text-error'}`}>
            {message.text}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-space-xs pt-2">
        <button
          type="button"
          disabled={isChecking || !canCheckout}
          onClick={() => router.push('/thanh-toan')}
          className="group w-full py-3.5 px-space-md rounded-full bg-primary-container text-on-primary font-display text-label-lg font-bold flex items-center justify-center gap-space-xs shadow-md hover:bg-primary active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          TIẾN HÀNH ĐẶT HÀNG
          <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-1 transition-transform" />
        </button>
        <Link
          href="/products"
          className="w-full py-2.5 rounded-full text-center text-on-surface-variant hover:text-secondary font-display text-label-md flex items-center justify-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tiếp tục chọn đồ uống
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-space-sm rounded-lg text-center">
        {PERKS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center">
            <Icon className="w-5 h-5 text-secondary" />
            <span className="font-display text-label-sm text-on-surface mt-1">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};