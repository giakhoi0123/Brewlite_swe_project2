'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../components/auth/AuthProvider';
import { useCart } from '../../components/cart/CartProvider';
import { computeCartSummary } from '../../lib/cart-summary';
import {
  CheckoutApiError,
  createOrderApi,
  PaymentMethod,
  PaymentResponse,
  processPaymentApi,
} from '../../services/checkout-api';
import { formatCurrency } from '../../utils/format';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { items, voucherCode, isReady, clearCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WALLET');
  const [mockScenario, setMockScenario] = useState<string>('SUCCESS');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [lastPaymentResult, setLastPaymentResult] = useState<PaymentResponse | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const summary = useMemo(() => computeCartSummary(items, voucherCode), [items, voucherCode]);

  // 1. Kiểm tra trạng thái tải
  if (!isReady || authLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-display text-body-md text-on-surface-variant">Đang tải thông tin đặt hàng...</p>
      </div>
    );
  }

  // 2. Kiểm tra xác thực khách hàng (Authentication Gate)
  if (!user) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-on-surface mb-2">
          Yêu cầu đăng nhập để thanh toán
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Vui lòng đăng nhập hoặc tạo tài khoản để hoàn tất đơn hàng và tích lũy điểm thưởng.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?redirect=/checkout"
            className="px-6 py-3 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold hover:bg-primary/90 transition-all shadow-md"
          >
            Đăng nhập ngay
          </Link>
          <Link
            href="/thuc-don"
            className="px-6 py-3 rounded-full bg-surface-container text-on-surface font-display text-label-lg font-medium hover:bg-surface-container-high transition-all"
          >
            Xem thực đơn
          </Link>
        </div>
      </div>
    );
  }

  // 3. Hiển thị màn hình thành công khi đơn đã PAID
  if (lastPaymentResult && lastPaymentResult.paymentStatus === 'PAID') {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16">
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-secondary text-on-secondary flex items-center justify-center mb-4 shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="font-display text-headline-sm font-bold text-on-surface">Đặt hàng thành công!</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Đơn hàng của bạn đã được thanh toán và chuyển đến quầy pha chế Barista.
          </p>

          <div className="w-full my-6 p-4 rounded-xl bg-surface-container-low text-left space-y-2 border border-outline-variant/20">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-on-surface">{confirmedOrderId}</span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Mã thanh toán:</span>
              <span className="font-mono text-on-surface-variant">{lastPaymentResult.paymentId}</span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Phương thức:</span>
              <span className="font-semibold text-on-surface">
                {lastPaymentResult.method === 'WALLET' ? 'Ví điện tử BrewLite' : 'Thẻ thanh toán'}
              </span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Tổng thanh toán:</span>
              <span className="font-bold text-secondary text-body-md">
                {formatCurrency(lastPaymentResult.amount)}
              </span>
            </div>
            {lastPaymentResult.processedAt && (
              <div className="flex justify-between text-body-sm pt-1 border-t border-outline-variant/20">
                <span className="text-on-surface-variant">Thời gian xử lý:</span>
                <span className="text-on-surface-variant">
                  {new Date(lastPaymentResult.processedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              href="/thuc-don"
              className="flex-1 py-3 px-4 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold text-center hover:bg-primary/90 transition-all shadow-md"
            >
              Tiếp tục đặt món
            </Link>
            <Link
              href="/"
              className="flex-1 py-3 px-4 rounded-full bg-surface-container text-on-surface font-display text-label-lg font-medium text-center hover:bg-surface-container-high transition-all"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Kiểm tra giỏ hàng rỗng
  if (items.length === 0) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container text-outline flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-on-surface mb-2">
          Giỏ hàng của bạn đang trống
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Hãy chọn các món cà phê yêu thích từ thực đơn để tiếp tục thanh toán.
        </p>
        <Link
          href="/thuc-don"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold hover:bg-primary/90 transition-all shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          Khám phá thực đơn
        </Link>
      </div>
    );
  }

  // 5. Hàm thực hiện thanh toán tuân thủ Sequence Checkout Diagram & ADR-004
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      // BƯỚC 1: POST /api/orders (Tạo đơn hàng PENDING)
      const orderPayload = {
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          selectedOptions: [
            ...(it.customization.size ? [it.customization.size] : []),
            ...(it.customization.toppingIds || []),
          ],
        })),
        voucherCode: voucherCode || undefined,
      };

      const orderRes = await createOrderApi(orderPayload, token);
      const currentOrderId = orderRes.id;
      setConfirmedOrderId(currentOrderId);

      // BƯỚC 2: Sinh Idempotency-Key chuẩn UUID
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // BƯỚC 3: POST /api/payments (Xử lý thanh toán)
      const paymentRes = await processPaymentApi(
        currentOrderId,
        paymentMethod,
        idempotencyKey,
        token,
        process.env.NODE_ENV !== 'production' ? mockScenario : undefined,
      );

      setLastPaymentResult(paymentRes);

      // BƯỚC 4: Xử lý các trạng thái phản hồi theo hợp đồng
      if (paymentRes.paymentStatus === 'PAID') {
        // Chỉ xóa giỏ hàng khi backend xác nhận thanh toán thành công
        clearCart();
      } else if (paymentRes.paymentStatus === 'PROCESSING') {
        setWarningMessage(
          'Giao dịch đang được xử lý (202 PROCESSING). Đơn hàng đang được giữ trạng thái PENDING. Vui lòng không tạo thêm yêu cầu thanh toán trùng lặp.',
        );
      } else if (paymentRes.paymentStatus === 'UNKNOWN') {
        setWarningMessage(
          'Yêu cầu thanh toán vượt thời gian chờ hoặc trạng thái chưa xác định (202 UNKNOWN/TIMEOUT). Hệ thống đang lưu đơn để đối soát, không tự động trừ tiền lần hai.',
        );
      } else if (paymentRes.paymentStatus === 'FAILED') {
        setErrorMessage(
          'Giao dịch bị từ chối bởi cổng thanh toán (PAYMENT_DECLINED). Bạn có thể thử lại bằng phương thức khác.',
        );
      }
    } catch (err: any) {
      if (err instanceof CheckoutApiError) {
        if (err.statusCode === 409) {
          setErrorMessage(
            'Xung đột tồn kho hoặc đơn hàng (409 Conflict): ' + err.message,
          );
        } else if (err.code === 'MODULE_PENDING_HANDOFF') {
          setWarningMessage(
            'Lưu ý kỹ thuật: ' +
              err.message +
              ' (Giao diện Checkout đã tích hợp đúng chuẩn API Contract, đang đợi hoàn tất kết nối backend từ đồng đội Điệp/Kiệt).',
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage(err.message || 'Đã xảy ra lỗi không xác định khi xử lý thanh toán.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto px-margin md:px-margin-lg py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/gio-hang"
            className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại giỏ hàng
          </Link>
          <h1 className="font-display text-headline-md font-bold text-on-surface">
            Xác nhận thanh toán
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-secondary text-body-sm font-medium bg-secondary-container/30 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4" />
          <span>Bảo mật chuẩn PCI-DSS</span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-error-container/40 border border-error/30 text-error flex items-start gap-3 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-body-sm">
            <p className="font-semibold">Thanh toán chưa hoàn tất</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {warningMessage && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 animate-in fade-in"
        >
          <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-body-sm">
            <p className="font-semibold">Trạng thái xử lý giao dịch</p>
            <p>{warningMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cột trái: Tùy chọn thanh toán & Thông tin nhận hàng */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Thông tin khách hàng */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
            <h2 className="font-display text-title-md font-bold text-on-surface mb-3">
              Thông tin khách hàng
            </h2>
            <div className="text-body-sm space-y-1 text-on-surface-variant">
              <p>
                <strong className="text-on-surface">Khách hàng:</strong> {user.fullName}
              </p>
              <p>
                <strong className="text-on-surface">Email:</strong> {user.email}
              </p>
              <p className="text-[12px] text-outline pt-1">
                * Mã đơn hàng và thông báo trạng thái đơn sẽ được liên kết với tài khoản này.
              </p>
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
            <h2 className="font-display text-title-md font-bold text-on-surface mb-3">
              Phương thức thanh toán
            </h2>

            <div className="flex flex-col gap-3">
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'WALLET'
                    ? 'border-secondary bg-secondary-container/20 ring-1 ring-secondary'
                    : 'border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="WALLET"
                  checked={paymentMethod === 'WALLET'}
                  onChange={() => setPaymentMethod('WALLET')}
                  className="accent-secondary w-4 h-4"
                />
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-body-md text-on-surface">Ví điện tử BrewLite (WALLET)</p>
                  <p className="text-body-sm text-on-surface-variant">Thanh toán nhanh chóng không tốn phí</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-secondary bg-secondary-container/20 ring-1 ring-secondary'
                    : 'border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CARD"
                  checked={paymentMethod === 'CARD'}
                  onChange={() => setPaymentMethod('CARD')}
                  className="accent-secondary w-4 h-4"
                />
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-body-md text-on-surface">Thẻ ngân hàng / Thẻ quốc tế (CARD)</p>
                  <p className="text-body-sm text-on-surface-variant">Hỗ trợ Visa, Mastercard, Napas</p>
                </div>
              </label>
            </div>

            {/* Mock Scenario Switcher (Chỉ hiển thị môi trường thử nghiệm / dev theo contract của Kiệt) */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                <label
                  htmlFor="checkout-mock-scenario"
                  className="block text-[12px] font-semibold text-outline uppercase tracking-wider mb-1"
                >
                  Kịch bản thử nghiệm thanh toán (Dev / Contract Test)
                </label>
                <select
                  id="checkout-mock-scenario"
                  value={mockScenario}
                  onChange={(e) => setMockScenario(e.target.value)}
                  className="w-full text-body-sm p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface"
                >
                  <option value="SUCCESS">SUCCESS — 200 PAID (Thành công)</option>
                  <option value="FAILURE">FAILURE — 402 PAYMENT_DECLINED (Thất bại)</option>
                  <option value="PROCESSING">PROCESSING — 202 PROCESSING (Đang xử lý)</option>
                  <option value="TIMEOUT">TIMEOUT — 202 UNKNOWN (Hết thời gian chờ)</option>
                  <option value="UNKNOWN">UNKNOWN — 202 UNKNOWN (Không rõ trạng thái)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Tóm tắt đơn hàng & Nút Xác nhận */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-4">
            <h2 className="font-display text-title-md font-bold text-on-surface">
              Chi tiết các món ({summary.itemCount})
            </h2>

            <div className="divide-y divide-outline-variant/20 max-h-64 overflow-y-auto pr-1">
              {items.map((line) => (
                <div key={line.lineId} className="py-2.5 flex justify-between gap-2 text-body-sm">
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">
                      {line.name} <span className="text-secondary font-bold">×{line.quantity}</span>
                    </p>
                    <p className="text-[12px] text-on-surface-variant">
                      Size {line.customization.size}
                      {line.customization.toppingIds && line.customization.toppingIds.length > 0 && ` + ${line.customization.toppingIds.length} topping`}
                      {line.customization.note && ` (${line.customization.note})`}
                    </p>
                  </div>
                  <span className="font-medium text-on-surface shrink-0">
                    {formatCurrency(line.unitPrice * line.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-outline-variant/30 space-y-2 text-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Tạm tính:</span>
                <span className="font-medium text-on-surface">{formatCurrency(summary.subtotal)}</span>
              </div>

              {summary.discount > 0 && (
                <div className="flex justify-between text-secondary">
                  <span>Giảm giá ({voucherCode}):</span>
                  <span className="font-semibold">-{formatCurrency(summary.discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-on-surface-variant">
                <span>Phí vận chuyển:</span>
                <span className="font-medium text-on-surface">
                  {summary.shipping === 0 ? 'Miễn phí' : formatCurrency(summary.shipping)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-outline-variant/30">
                <span className="font-bold text-body-md text-on-surface">Tổng cộng:</span>
                <span className="font-display text-headline-sm font-bold text-secondary">
                  {formatCurrency(summary.total)}
                </span>
              </div>
              <p className="text-[11px] text-outline text-right italic">
                * Giá chính thức được tính toán và xác thực tại máy chủ backend
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckoutSubmit}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  <span>ĐANG XỬ LÝ THANH TOÁN...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>XÁC NHẬN THANH TOÁN ({formatCurrency(summary.total)})</span>
                </>
              )}
            </button>

            {errorMessage && (
              <button
                type="button"
                onClick={handleCheckoutSubmit}
                disabled={submitting}
                className="w-full py-2.5 rounded-full border border-secondary text-secondary font-display text-label-md flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Thử thanh toán lại</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
