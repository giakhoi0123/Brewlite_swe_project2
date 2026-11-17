"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { useAuth } from "../../components/auth/AuthProvider";
import { useCart } from "../../components/cart/CartProvider";
import { computeCartSummary } from "../../lib/cart-summary";
import {
  CheckoutApiError,
  createOrderApi,
  PaymentMethod,
  PaymentResponse,
  processPaymentApi,
} from "../../services/checkout-api";
import { formatCurrency } from "../../utils/format";

function createIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // RFC 4122 UUID v4 fallback for test/legacy browser environments only.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isPostgresUuid(value?: string): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}

const PENDING_CHECKOUT_KEY = "brewlite.pending-vnpay-checkout";

interface PendingCheckout {
  orderId: string;
  idempotencyKey?: string;
  paymentId?: string;
  cartSignature?: string;
}

function buildCartSignature(
  items: Array<{
    productId: string;
    quantity: number;
    customization?: { size?: string; toppingIds?: string[]; note?: string };
  }>,
  voucherCode: string | null,
): string {
  return JSON.stringify({
    voucherCode: voucherCode?.trim() || null,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.customization?.size ?? "",
      toppingIds: [...(item.customization?.toppingIds ?? [])].sort(),
      note: item.customization?.note?.trim() ?? "",
    })),
  });
}

function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    return stored ? (JSON.parse(stored) as PendingCheckout) : null;
  } catch {
    return null;
  }
}

function writePendingCheckout(value: PendingCheckout): void {
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(value));
}

export default function CheckoutPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { items, voucherCode, isReady, clearCart, isChecking, canCheckout } =
    useCart();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [lastPaymentResult, setLastPaymentResult] =
    useState<PaymentResponse | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(
    () => readPendingCheckout()?.orderId ?? null,
  );
  const [paymentAttemptKey, setPaymentAttemptKey] = useState<string | null>(
    () => readPendingCheckout()?.idempotencyKey ?? null,
  );

  const summary = useMemo(
    () => computeCartSummary(items, voucherCode),
    [items, voucherCode],
  );
  const cartSignature = useMemo(
    () => buildCartSignature(items, voucherCode),
    [items, voucherCode],
  );

  useEffect(() => {
    if (!isReady) return;
    const pending = readPendingCheckout();
    if (
      pending?.orderId &&
      pending.cartSignature &&
      pending.cartSignature !== cartSignature
    ) {
      window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      setConfirmedOrderId(null);
      setPaymentAttemptKey(null);
      setLastPaymentResult(null);
    }
  }, [isReady, cartSignature]);

  // Hàm hỗ trợ format hiển thị Size thân thiện (chuyển đổi ID UUID rác thành tên Size)
  const formatSizeLabel = (sizeInput?: string) => {
    if (!sizeInput) return "Vừa (M)";
    // Nếu sizeInput là chuỗi UUID 8-4-4-4-12 (như b0000000-0000...) thì chuyển về nhãn mặc định
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(sizeInput)) {
      return "Vừa (M)";
    }
    return sizeInput;
  };

  // 1. Kiểm tra trạng thái tải
  if (!isReady || authLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-display text-body-md text-on-surface-variant">
          Đang tải thông tin đặt hàng...
        </p>
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
          Vui lòng đăng nhập hoặc tạo tài khoản để hoàn tất đơn hàng và tích lũy
          điểm thưởng.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?redirect=/checkout"
            className="px-6 py-3 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold hover:bg-primary/90 transition-all shadow-md"
          >
            Đăng nhập ngay
          </Link>
          <Link
            href="/products"
            className="px-6 py-3 rounded-full bg-surface-container text-on-surface font-display text-label-lg font-medium hover:bg-surface-container-high transition-all"
          >
            Xem thực đơn
          </Link>
        </div>
      </div>
    );
  }

  // 3. Hiển thị màn hình thành công khi đơn đã PAID
  if (lastPaymentResult && lastPaymentResult.paymentStatus === "PAID") {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16">
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-secondary text-on-secondary flex items-center justify-center mb-4 shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="font-display text-headline-sm font-bold text-on-surface">
            Đặt hàng thành công!
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Đơn hàng của bạn đã được thanh toán và chuyển đến quầy pha chế
            Barista.
          </p>

          <div className="w-full my-6 p-4 rounded-xl bg-surface-container-low text-left space-y-2 border border-outline-variant/20">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-on-surface">
                {confirmedOrderId}
              </span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Mã thanh toán:</span>
              <span className="font-mono text-on-surface-variant">
                {lastPaymentResult.paymentId}
              </span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Phương thức:</span>
              <span className="font-semibold text-on-surface">
                VNPay Sandbox
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
                <span className="text-on-surface-variant">
                  Thời gian xử lý:
                </span>
                <span className="text-on-surface-variant">
                  {new Date(lastPaymentResult.processedAt).toLocaleString(
                    "vi-VN",
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              href="/products"
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
          href="/products"
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
    if (submitting || isChecking || !canCheckout) return;

    setSubmitting(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const pending = readPendingCheckout();
      const isStaleOrder = Boolean(
        pending?.cartSignature && pending.cartSignature !== cartSignature,
      );
      if (isStaleOrder) {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      }

      // BƯỚC 1: Chỉ tạo Order lần đầu hoặc khi giỏ hàng/voucher đã thay đổi.
      let currentOrderId = isStaleOrder ? null : confirmedOrderId;
      if (!currentOrderId) {
        const orderPayload = {
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            selectedOptions: Array.from(
              new Set(
                [
                  item.customization.size,
                  ...item.customization.toppingIds,
                ].filter(isPostgresUuid),
              ),
            ),
            ...(item.customization.note?.trim()
              ? { notes: item.customization.note.trim() }
              : {}),
          })),
          voucherCode: voucherCode || undefined,
        };

        const orderRes = await createOrderApi(orderPayload, token);
        currentOrderId = orderRes.id;
        setConfirmedOrderId(currentOrderId);
        writePendingCheckout({ orderId: currentOrderId, cartSignature });
      }

      // BƯỚC 2: Network/UNKNOWN retry dùng lại key; decline xác định dùng key mới.
      const isDeclinedRetry = lastPaymentResult?.paymentStatus === "FAILED";
      let idempotencyKey = isStaleOrder ? null : paymentAttemptKey;
      if (!idempotencyKey || isDeclinedRetry) {
        idempotencyKey = createIdempotencyKey();
        setPaymentAttemptKey(idempotencyKey);
      }
      if (isDeclinedRetry) {
        setLastPaymentResult(null);
      }

      // BƯỚC 3: POST /api/payments (Xử lý thanh toán)
      const paymentRes = await processPaymentApi(
        currentOrderId,
        "VNPAY" satisfies PaymentMethod,
        idempotencyKey,
        token,
      );

      setLastPaymentResult(paymentRes);

      // BƯỚC 4: Kiểm tra trạng thái đã chốt trước khi redirect để tránh quay lại checkoutUrl cũ
      if (paymentRes.paymentStatus === "PAID") {
        clearCart();
        window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
        return;
      }

      if (paymentRes.paymentStatus === "FAILED") {
        setPaymentAttemptKey(null);
        writePendingCheckout({ orderId: currentOrderId, cartSignature });
        setErrorMessage(
          "Giao dịch bị từ chối bởi cổng thanh toán (PAYMENT_DECLINED). Bạn có thể thử lại bằng phương thức khác.",
        );
        return;
      }

      if (paymentRes.paymentStatus === "PROCESSING" && paymentRes.checkoutUrl) {
        writePendingCheckout({
          orderId: currentOrderId,
          idempotencyKey,
          paymentId: paymentRes.paymentId,
          cartSignature,
        });
        window.location.assign(paymentRes.checkoutUrl);
        return;
      }

      if (paymentRes.paymentStatus === "PROCESSING") {
        setWarningMessage(
          "Giao dịch đang được xử lý (202 PROCESSING). Đơn hàng đang được giữ trạng thái PENDING. Vui lòng không tạo thêm yêu cầu thanh toán trùng lặp.",
        );
      } else if (paymentRes.paymentStatus === "UNKNOWN") {
        setWarningMessage(
          "Yêu cầu thanh toán vượt thời gian chờ hoặc trạng thái chưa xác định (202 UNKNOWN/TIMEOUT). Hệ thống đang lưu đơn để đối soát, không tự động trừ tiền lần hai.",
        );
      }
    } catch (err: any) {
      if (err instanceof CheckoutApiError) {
        if (err.statusCode === 409) {
          setErrorMessage(
            "Xung đột tồn kho hoặc đơn hàng (409 Conflict): " + err.message,
          );
        } else if (err.code === "MODULE_PENDING_HANDOFF") {
          setWarningMessage(
            "Lưu ý kỹ thuật: " +
              err.message +
              " (Giao diện Checkout đã tích hợp đúng chuẩn API Contract, đang đợi hoàn tất kết nối backend).",
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage(
          err.message || "Đã xảy ra lỗi không xác định khi xử lý thanh toán.",
        );
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
                <strong className="text-on-surface">Khách hàng:</strong>{" "}
                {user.fullName}
              </p>
              <p>
                <strong className="text-on-surface">Email:</strong> {user.email}
              </p>
              <p className="text-[12px] text-outline pt-1">
                * Mã đơn hàng và thông báo trạng thái đơn sẽ được liên kết với
                tài khoản này.
              </p>
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
            <h2 className="font-display text-title-md font-bold text-on-surface mb-3">
              Phương thức thanh toán
            </h2>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-secondary bg-secondary-container/20 ring-1 ring-secondary">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-body-md text-on-surface">
                  VNPay Sandbox
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  Bạn sẽ được chuyển tới cổng VNPay để chọn ngân hàng hoặc quét
                  QR.
                </p>
              </div>
            </div>
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
                <div
                  key={line.lineId}
                  className="py-2.5 flex justify-between gap-2 text-body-sm"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">
                      {line.name}{" "}
                      <span className="text-secondary font-bold">
                        ×{line.quantity}
                      </span>
                    </p>
                    <p className="text-[12px] text-on-surface-variant">
                      Size {formatSizeLabel(line.customization?.size)}
                      {line.customization?.toppingIds &&
                        line.customization.toppingIds.length > 0 &&
                        ` + ${line.customization.toppingIds.length} topping`}
                      {line.customization?.note &&
                        ` (${line.customization.note})`}
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
                <span className="font-medium text-on-surface">
                  {formatCurrency(summary.subtotal)}
                </span>
              </div>

              {summary.discount > 0 && (
                <div className="flex justify-between text-secondary">
                  <span>Giảm giá ({voucherCode}):</span>
                  <span className="font-semibold">
                    -{formatCurrency(summary.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-on-surface-variant">
                <span>Phí giao hàng:</span>
                <span className="font-medium text-on-surface">
                  {summary.shipping === 0
                    ? "Miễn phí"
                    : formatCurrency(summary.shipping)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-outline-variant/30">
                <span className="font-bold text-body-md text-on-surface">
                  Tổng cộng:
                </span>
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
              disabled={submitting || isChecking || !canCheckout}
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
                  <span>
                    THANH TOÁN QUA VNPAY ({formatCurrency(summary.total)})
                  </span>
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
