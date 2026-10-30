'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types/product';
import { ProductCard } from './ProductCard';
import { fetchProductsFromApi } from '../services/product-api';
import { Search, RotateCcw, AlertCircle, Coffee } from 'lucide-react';

interface MenuCatalogProps {
  initialSearch?: string;
  fetchProducts?: (search: string, signal?: AbortSignal) => Promise<Product[]>;
}

export const MenuCatalog: React.FC<MenuCatalogProps> = ({
  initialSearch = '',
  fetchProducts,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use ref to ignore outdated requests
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadProducts = useCallback(
    async (query: string) => {
      // Cancel previous in-flight HTTP request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentRequestId = ++activeRequestIdRef.current;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        let data: Product[];

        if (fetchProducts) {
          data = await fetchProducts(query, controller.signal);
        } else {
          data = await fetchProductsFromApi(query, controller.signal);
        }

        // Only update state if this is still the most recent request
        if (currentRequestId === activeRequestIdRef.current) {
          setProducts(Array.isArray(data) ? data : []);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Request was aborted by user typing a new query; ignore
          return;
        }

        if (currentRequestId === activeRequestIdRef.current) {
          setErrorMessage(err.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
          setIsLoading(false);
        }
      }
    },
    [fetchProducts],
  );

  useEffect(() => {
    loadProducts(searchTerm);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadProducts, searchTerm]);

  const handleRetry = () => {
    loadProducts(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Search Bar - Responsive */}
      <section aria-label="Tìm kiếm món" className="mb-8">
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên món (VD: Cà phê, Trà, Bạc xỉu...)"
            aria-label="Tìm kiếm sản phẩm"
            className="w-full pl-10 pr-24 py-3 bg-white border border-stone-200 rounded-2xl text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brew-600 focus:border-transparent shadow-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-stone-400 hover:text-stone-600"
            >
              Xóa tìm
            </button>
          )}
        </div>
      </section>

      {/* Main Content Area: Loading, Error, Empty, or Product Grid */}
      <main aria-live="polite">
        {/* 1. LOADING STATE */}
        {isLoading && (
          <div data-testid="loading-state" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-stone-200 p-3 shadow-sm animate-pulse flex flex-col"
              >
                <div className="aspect-square w-full bg-stone-200 rounded-xl mb-3" />
                <div className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-200 rounded w-1/2 mb-4" />
                <div className="mt-auto flex justify-between items-center pt-2 border-t border-stone-100">
                  <div className="h-5 bg-stone-200 rounded w-1/3" />
                  <div className="h-8 bg-stone-200 rounded-xl w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. ERROR STATE & RETRY */}
        {!isLoading && errorMessage && (
          <div
            data-testid="error-state"
            role="alert"
            className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-red-50/60 border border-red-200 rounded-3xl max-w-lg mx-auto"
          >
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-red-900 mb-2">Đã có lỗi xảy ra</h3>
            <p className="text-sm text-red-700 max-w-sm mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Thử lại ngay
            </button>
          </div>
        )}

        {/* 3. EMPTY STATE */}
        {!isLoading && !errorMessage && products.length === 0 && (
          <div
            data-testid="empty-state"
            className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-stone-50 border border-dashed border-stone-300 rounded-3xl max-w-md mx-auto"
          >
            <div className="p-4 bg-stone-100 text-stone-500 rounded-2xl mb-4">
              <Coffee className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-1">Không tìm thấy món phù hợp</h3>
            <p className="text-sm text-stone-500 mb-6 leading-relaxed">
              {searchTerm
                ? `Không có kết quả nào cho "${searchTerm}". Vui lòng thử tìm với từ khóa khác.`
                : 'Thực đơn hiện tại chưa có món nào sẵn sàng. Vui lòng quay lại sau!'}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="inline-flex items-center px-4 py-2 border border-stone-300 text-sm font-semibold rounded-xl text-stone-700 bg-white hover:bg-stone-50 shadow-sm transition-colors"
              >
                Xem tất cả thực đơn
              </button>
            )}
          </div>
        )}

        {/* 4. SUCCESS PRODUCT CATALOG GRID */}
        {!isLoading && !errorMessage && products.length > 0 && (
          <div
            data-testid="product-grid"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
