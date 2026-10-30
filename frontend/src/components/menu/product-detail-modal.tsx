"use client";

import { useEffect, useState, useId } from "react";
import Image from "next/image";
import { fetchProductDetail } from "@/lib/products";
import type { ProductDetail } from "@/types/product-detail";
import styles from "./menu.module.css";

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export type ProductDetailModalProps = {
  productId: string;
  onClose: () => void;
};

export function ProductDetailModal({ productId, onClose }: ProductDetailModalProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedSizeId, setSelectedSizeId] = useState<string>("");
  const [selectedToppingIds, setSelectedToppingIds] = useState<Set<string>>(new Set());
  const [imageFailed, setImageFailed] = useState(false);
  const modalTitleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchProductDetail(productId, controller.signal)
      .then((data) => {
        if (!active || controller.signal.aborted) return;
        setDetail(data);
        setSelectedSizeId(data.defaultSizeId);
        setSelectedToppingIds(new Set());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [productId, retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount((prev) => prev + 1);
  };

  const selectedSize = detail?.sizes.find((size) => size.id === selectedSizeId);
  const sizeExtra = selectedSize?.extraPrice ?? 0;
  const toppingsExtra = detail
    ? Array.from(selectedToppingIds).reduce((sum, toppingId) => {
        const top = detail.toppings.find((t) => t.id === toppingId);
        return sum + (top?.extraPrice ?? 0);
      }, 0)
    : 0;
  const totalPrice = (detail?.price ?? 0) + sizeExtra + toppingsExtra;

  const toggleTopping = (toppingId: string) => {
    setSelectedToppingIds((prev) => {
      const next = new Set(prev);
      if (next.has(toppingId)) {
        next.delete(toppingId);
      } else {
        next.add(toppingId);
      }
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--menu-radius-panel)] bg-[var(--menu-card)] shadow-[var(--menu-shadow-medium)] text-[var(--menu-ink)]">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--menu-outline-variant)]/40 px-4 py-3 sm:px-6">
          <h2 id={modalTitleId} className={`${styles.headline} text-lg font-bold truncate`}>
            {loading ? "Đang tải chi tiết..." : detail?.name ?? "Chi tiết sản phẩm"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="rounded-full p-2 text-[var(--menu-muted)] hover:bg-[var(--menu-surface-container)] hover:text-[var(--menu-ink)] transition-colors"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal content body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {loading && (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="size-10 animate-spin rounded-full border-4 border-[var(--menu-outline-variant)] border-t-[var(--menu-primary)]" />
              <p className="text-sm text-[var(--menu-muted)]">Đang kết nối backend và tải dữ liệu món...</p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-[var(--menu-radius-panel)] bg-[var(--menu-error-container)] p-6 text-center text-[var(--menu-on-error-container)]">
              <p className="font-semibold text-base">Chưa tải được chi tiết món</p>
              <p className="text-xs">{error}</p>
              <button type="button" onClick={handleRetry} className={`${styles.action} mt-2 text-xs py-2 px-4`}>
                Thử lại
              </button>
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Product hero banner */}
              <div className="relative aspect-video w-full overflow-hidden rounded-[var(--menu-radius-image)] bg-[var(--menu-surface-container)]">
                {detail.imageUrl && !imageFailed ? (
                  <Image
                    src={detail.imageUrl}
                    alt={detail.name}
                    fill
                    unoptimized
                    className="object-cover"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-[var(--menu-muted)]">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-12">
                      <path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 4v2M12 3v3M16 4v2M3 21h16" />
                    </svg>
                    <span className="text-xs">Ảnh đang cập nhật</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {detail.description && (
                <div>
                  <p className="text-xs font-semibold text-[var(--menu-muted)] uppercase tracking-wide">Mô tả</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--menu-ink)]">{detail.description}</p>
                </div>
              )}

              {/* Sizes selection */}
              <div>
                <p className="text-xs font-semibold text-[var(--menu-muted)] uppercase tracking-wide">Chọn kích cỡ (Size)</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {detail.sizes.map((size) => {
                    const isSelected = size.id === selectedSizeId;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        disabled={!size.available}
                        onClick={() => setSelectedSizeId(size.id)}
                        className={`flex flex-col items-center justify-center rounded-[var(--menu-radius-panel)] border p-3 text-center transition-all ${
                          isSelected
                            ? "border-[var(--menu-primary)] bg-[var(--menu-primary-fixed-dim)]/30 font-bold text-[var(--menu-primary)]"
                            : size.available
                            ? "border-[var(--menu-outline-variant)] hover:bg-[var(--menu-surface-container)]"
                            : "opacity-40 cursor-not-allowed border-dashed"
                        }`}
                      >
                        <span className="text-sm">{size.name}</span>
                        <span className="text-xs text-[var(--menu-muted)] mt-1">
                          {size.extraPrice > 0 ? `+${vnd.format(size.extraPrice)}` : "Chuẩn"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toppings selection */}
              {detail.toppings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--menu-muted)] uppercase tracking-wide">Topping thêm</p>
                  <div className="mt-2 space-y-2">
                    {detail.toppings.map((top) => {
                      const isChecked = selectedToppingIds.has(top.id);
                      return (
                        <label
                          key={top.id}
                          className={`flex items-center justify-between rounded-[var(--menu-radius-base)] border p-3 transition-colors ${
                            top.available
                              ? "cursor-pointer hover:bg-[var(--menu-surface-container)] border-[var(--menu-outline-variant)]"
                              : "opacity-40 cursor-not-allowed border-dashed"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={!top.available}
                              checked={isChecked}
                              onChange={() => toggleTopping(top.id)}
                              className="size-4 rounded accent-[var(--menu-primary)]"
                            />
                            <span className="text-sm">{top.name}</span>
                          </div>
                          <span className="text-xs text-[var(--menu-muted)] tabular-nums">
                            +{vnd.format(top.extraPrice)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price total calculation */}
              <div className="rounded-[var(--menu-radius-panel)] bg-[var(--menu-surface-container)] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--menu-muted)]">Tổng cộng ước tính</p>
                  <p className={`${styles.headline} text-xl font-bold text-[var(--menu-primary)] tabular-nums`}>
                    {vnd.format(totalPrice)}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--menu-muted)]">
                  <span>Giá gốc: {vnd.format(detail.price)}</span>
                </div>
              </div>

              {/* Sprint 2 Notice */}
              <div className="rounded-[var(--menu-radius-panel)] border border-[var(--menu-outline-variant)]/60 bg-[var(--menu-surface-low)] p-3 text-xs text-[var(--menu-muted)]">
                <p className="font-semibold text-[var(--menu-ink)]">☕ Lát cắt Sprint 1 (Menu & Product Detail MVP):</p>
                <p className="mt-1">
                  Đã tải dữ liệu kích cỡ và topping thực tế từ backend NestJS qua API <code>GET /api/products/:id</code>.
                  Chức năng giỏ hàng, đặt đơn và thanh toán thuộc phạm vi Sprint 2 (Task 5).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal footer */}
        <div className="border-t border-[var(--menu-outline-variant)]/40 px-4 py-3 sm:px-6 flex justify-end gap-3 bg-[var(--menu-surface-low)]">
          <button type="button" onClick={onClose} className={styles.action}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
