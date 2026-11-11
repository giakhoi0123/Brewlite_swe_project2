'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCartItem,
  CartItem,
  changeLineSize,
  NewCartItem,
  removeLine,
  sanitizeCartItems,
  setLineQuantity,
} from '../../lib/cart';
import { checkCartAvailability } from '../../services/product-api';
import { SizeCode } from '../../types/menu';

export type { CartItem } from '../../lib/cart';

interface CartContextValue {
  /** false cho tới khi đọc xong localStorage — tránh nháy "giỏ trống". */
  isReady: boolean;
  stockError: string | null;
  /** Số ly tối đa của từng dòng (theo lineId) từ lần kiểm tra nguyên liệu gần nhất. */
  lineLimits: Record<string, number>;
  isChecking: boolean;
  canCheckout: boolean;
  items: CartItem[];
  totalQuantity: number;
  totalPrice: number;
  voucherCode: string | null;
  addItem: (item: NewCartItem) => Promise<boolean>;
  updateQuantity: (lineId: string, quantity: number) => Promise<boolean>;
  updateSize: (lineId: string, size: SizeCode) => Promise<boolean>;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  setVoucherCode: (code: string | null) => void;
}

const STORAGE_KEY = 'brewlite-cart';

interface StoredCart {
  items: CartItem[];
  voucherCode: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Phiên bản cũ lưu thẳng mảng items.
        const stored: Partial<StoredCart> = Array.isArray(parsed) ? { items: parsed } : parsed;
        setItems(sanitizeCartItems(stored.items));
        setVoucherCode(typeof stored.voucherCode === 'string' ? stored.voucherCode : null);
      }
    } catch {
      // localStorage có thể bị chặn (chế độ ẩn danh) — giỏ hàng vẫn chạy trong bộ nhớ.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredCart = { items, voucherCode };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // bỏ qua
    }
  }, [items, voucherCode, hydrated]);

  const [stockError, setStockError] = useState<string | null>(null);
  const [lineLimits, setLineLimits] = useState<Record<string, number>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [canCheckout, setCanCheckout] = useState(false);
  const currentItems = useRef(items);
  const confirmedItems = useRef(items);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResolve = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    currentItems.current = items;
    if (revision.current === 0) confirmedItems.current = items;
  }, [items]);

  useEffect(() => () => {
    revision.current += 1;
    if (timer.current) clearTimeout(timer.current);
    pendingResolve.current?.(false);
  }, []);

  const commit = useCallback((change: (previous: CartItem[]) => CartItem[]) => {
    const next = change(currentItems.current);
    const requestRevision = ++revision.current;
    if (timer.current) clearTimeout(timer.current);
    pendingResolve.current?.(false);
    // Update quantity, price and badge immediately; validate after a short pause.
    currentItems.current = next;
    setItems(next);
    setStockError(null);
    setIsChecking(true);
    setCanCheckout(false);
    return new Promise<boolean>(resolve => {
      pendingResolve.current = resolve;
      timer.current = setTimeout(async () => {
        try {
          const result = next.length ? await checkCartAvailability(next) : null;
          if (requestRevision !== revision.current) return;
          if (result && !result.canOrder) {
            // Chỉ cập nhật giới hạn cho các dòng bị từ chối (các dòng khác giữ giới hạn đã xác nhận).
            const failed = result.items
              .filter((r) => !r.canOrder && next[r.index])
              .map((r) => ({ line: next[r.index], max: r.availableQuantity }));
            setLineLimits((prev) => {
              const updated = { ...prev };
              for (const { line, max } of failed) updated[line.lineId] = max;
              return updated;
            });
            // Ưu tiên báo dòng vừa bị người dùng thay đổi.
            const changed =
              failed.find(({ line }) => {
                const before = confirmedItems.current.find((c) => c.lineId === line.lineId);
                return !before || before.quantity !== line.quantity;
              }) ?? failed[0];
            setStockError(
              changed
                ? changed.max > 0
                  ? `${changed.line.name} chỉ còn đủ nguyên liệu cho tối đa ${changed.max} ly. Không thể tăng thêm.`
                  : `${changed.line.name} hiện đã hết nguyên liệu.`
                : 'Không đủ số lượng.',
            );
            currentItems.current = confirmedItems.current;
            setItems(confirmedItems.current);
            resolve(false);
          } else {
            if (result) {
              const limits: Record<string, number> = {};
              for (const r of result.items) {
                const line = next[r.index];
                if (line) limits[line.lineId] = r.availableQuantity;
              }
              setLineLimits(limits);
            } else {
              setLineLimits({});
            }
            confirmedItems.current = next;
            setCanCheckout(next.length > 0);
            resolve(true);
          }
        } catch (error) {
          if (requestRevision !== revision.current) return;
          setStockError(error instanceof Error ? error.message : 'Không thể kiểm tra tồn nguyên liệu.');
          currentItems.current = confirmedItems.current;
          setItems(confirmedItems.current);
          resolve(false);
        } finally {
          if (requestRevision === revision.current) {
            pendingResolve.current = null;
            setIsChecking(false);
          }
        }
      }, 250);
    });
  }, []);
  useEffect(() => {
    if (hydrated) void commit(previous => previous);
  }, [hydrated, commit]);

  const addItem = useCallback((item: NewCartItem) => commit(prev => addCartItem(prev, item)), [commit]);
  const updateQuantity = useCallback((lineId: string, quantity: number) => commit(prev => setLineQuantity(prev, lineId, quantity)), [commit]);
  const updateSize = useCallback((lineId: string, size: SizeCode) => commit(prev => changeLineSize(prev, lineId, size)), [commit]);
  const removeItem = useCallback((lineId: string) => {
    confirmedItems.current = removeLine(confirmedItems.current, lineId);
    void commit(prev => removeLine(prev, lineId));
  }, [commit]);
  const clearCart = useCallback(() => {
    confirmedItems.current = [];
    void commit(() => []);
    setVoucherCode(null);
  }, [commit]);

  const value = useMemo<CartContextValue>(
    () => ({
      isReady: hydrated,
      stockError,
      lineLimits,
      isChecking,
      canCheckout,
      items,
      totalQuantity: items.reduce((sum, line) => sum + line.quantity, 0),
      totalPrice: items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
      voucherCode,
      addItem,
      updateQuantity,
      updateSize,
      removeItem,
      clearCart,
      setVoucherCode,
    }),
    [canCheckout, stockError, lineLimits, isChecking, hydrated, items, voucherCode, addItem, updateQuantity, updateSize, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{stockError && <div role="alert" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-error-container text-error rounded-xl p-4 shadow-lg max-w-lg">{stockError}<button type="button" className="ml-4 underline" onClick={() => setStockError(null)}>Đóng</button></div>}{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart phải được dùng bên trong <CartProvider>');
  }
  return ctx;
}
