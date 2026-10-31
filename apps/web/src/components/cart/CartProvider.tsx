'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addCartItem,
  CartItem,
  changeLineSize,
  NewCartItem,
  removeLine,
  sanitizeCartItems,
  setLineQuantity,
} from '../../lib/cart';
import { SizeCode } from '../../types/menu';

export type { CartItem } from '../../lib/cart';

interface CartContextValue {
  /** false cho tới khi đọc xong localStorage — tránh nháy "giỏ trống". */
  isReady: boolean;
  items: CartItem[];
  totalQuantity: number;
  totalPrice: number;
  voucherCode: string | null;
  addItem: (item: NewCartItem) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateSize: (lineId: string, size: SizeCode) => void;
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

  const addItem = useCallback((item: NewCartItem) => setItems((prev) => addCartItem(prev, item)), []);
  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => setItems((prev) => setLineQuantity(prev, lineId, quantity)),
    [],
  );
  const updateSize = useCallback(
    (lineId: string, size: SizeCode) => setItems((prev) => changeLineSize(prev, lineId, size)),
    [],
  );
  const removeItem = useCallback((lineId: string) => setItems((prev) => removeLine(prev, lineId)), []);
  const clearCart = useCallback(() => {
    setItems([]);
    setVoucherCode(null);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      isReady: hydrated,
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
    [hydrated, items, voucherCode, addItem, updateQuantity, updateSize, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart phải được dùng bên trong <CartProvider>');
  }
  return ctx;
}
