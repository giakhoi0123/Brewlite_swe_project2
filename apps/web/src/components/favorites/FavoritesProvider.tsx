'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface FavoritesContextValue {
  isFavorite: (productId: string) => boolean;
  /** Trả về true nếu món vừa được thêm vào danh sách yêu thích. */
  toggleFavorite: (productId: string) => boolean;
}

const STORAGE_KEY = 'brewlite-favorites';

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setIds(JSON.parse(saved));
    } catch {
      // localStorage bị chặn — vẫn chạy trong bộ nhớ.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // bỏ qua
    }
  }, [ids, hydrated]);

  const isFavorite = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      const adding = !ids.includes(productId);
      setIds((prev) => (adding ? [...prev, productId] : prev.filter((id) => id !== productId)));
      return adding;
    },
    [ids],
  );

  const value = useMemo(() => ({ isFavorite, toggleFavorite }), [isFavorite, toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites phải được dùng bên trong <FavoritesProvider>');
  }
  return ctx;
}
