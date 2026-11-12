"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../components/auth/AuthProvider";
import { useCart } from "../../../components/cart/CartProvider";
import {
  CheckoutApiError,
  getPaymentStatusApi,
  PaymentResponse,
} from "../../../services/checkout-api";
import { formatCurrency } from "../../../utils/format";

const PENDING_CHECKOUT_KEY = "brewlite.pending-vnpay-checkout";
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;

export default function VnpayReturnPage() {
  const { user, token, loading } = useAuth();
  const { clearCart } = useCart();
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [message, setMessage] = useState(
    "Đang xác nhận kết quả thanh toán với máy chủ...",
  );
  const [invalidReturn, setInvalidReturn] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setMessage("Vui lòng đăng nhập lại để xem trạng thái giao dịch.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    const valid = params.get("valid") === "true";
    if (!valid || !paymentId) {
      setInvalidReturn(true);
      setMessage(
        "Dữ liệu VNPay trả về không hợp lệ hoặc không tìm thấy giao dịch.",
      );
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (attempt: number) => {
      try {
        const current = await getPaymentStatusApi(paymentId, token);
        if (cancelled) return;
        setPayment(current);

        if (current.paymentStatus === "PAID") {
          if (!cleared.current) {
            clearCart();
            window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
            cleared.current = true;
          }
          setMessage("VNPay đã xác nhận thanh toán thành công.");
          return;
        }

        if (current.paymentStatus === "FAILED") {
          const pending = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
          if (pending) {
            try {
              const value = JSON.parse(pending) as { orderId?: string };
              if (value.orderId) {
                window.sessionStorage.setItem(
                  PENDING_CHECKOUT_KEY,
                  JSON.stringify({ orderId: value.orderId }),
                );
              }
            } catch {
              window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
            }
          }
          setMessage(
            "Giao dịch không thành công. Bạn có thể quay lại để thử lại.",
          );
          return;
        }

        if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
          setMessage(
            "Giao dịch đang chờ VNPay gửi IPN. Bạn có thể kiểm tra lại sau.",
          );
          return;
        }
        timer = setTimeout(() => void poll(attempt + 1), POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof CheckoutApiError
            ? error.message
            : "Không thể kiểm tra trạng thái giao dịch.",
        );
      }
    };

    void poll(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [clearCart, loading, token, user]);

  const paid = payment?.paymentStatus === "PAID";
  const failed = payment?.paymentStatus === "FAILED" || invalidReturn;

  return (
    <div className="max-w-[640px] mx-auto px-4 py-16">
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl text-center flex flex-col items-center">
        {paid ? (
          <CheckCircle2 className="w-16 h-16 text-secondary mb-4" />
        ) : failed ? (
          <AlertCircle className="w-16 h-16 text-error mb-4" />
        ) : payment ? (
          <Clock className="w-16 h-16 text-amber-600 mb-4" />
        ) : (
          <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
        )}

        <h1 className="font-display text-headline-sm font-bold text-on-surface">
          {paid
            ? "Thanh toán thành công"
            : failed
              ? "Thanh toán chưa hoàn tất"
              : "Đang xác nhận VNPay"}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">{message}</p>

        {payment && (
          <div className="w-full my-6 p-4 rounded-xl bg-surface-container-low text-left space-y-2">
            <p className="text-body-sm">
              <strong>Mã thanh toán:</strong> {payment.paymentId}
            </p>
            <p className="text-body-sm">
              <strong>Mã đơn:</strong> {payment.orderId}
            </p>
            <p className="text-body-sm">
              <strong>Số tiền:</strong> {formatCurrency(payment.amount)}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
          {failed && (
            <Link
              href="/checkout"
              className="flex-1 py-3 px-4 rounded-full bg-primary text-on-primary font-bold text-center"
            >
              Thử thanh toán lại
            </Link>
          )}
          <Link
            href="/"
            className="flex-1 py-3 px-4 rounded-full bg-surface-container text-on-surface font-medium text-center"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
