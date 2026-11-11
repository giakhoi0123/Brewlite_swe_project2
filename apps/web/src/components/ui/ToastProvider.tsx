'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export type ToastVariant = 'success' | 'error';

interface ToastContextValue {
  /** variant mặc định là 'success' — giữ tương thích với các chỗ gọi cũ. */
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<ToastVariant>('success');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((text: string, nextVariant: ToastVariant = 'success') => {
    setMessage(text);
    setVariant(nextVariant);
    setVisible(true);
    clearTimeout(timerRef.current);
    // Thông báo lỗi giữ lâu hơn để người dùng kịp đọc.
    timerRef.current = setTimeout(() => setVisible(false), nextVariant === 'error' ? 4000 : 2500);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="status"
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        data-testid="app-toast"
        className={`fixed top-24 right-4 sm:right-6 z-[60] ${
          variant === 'error' ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
        } px-space-md py-3 rounded-xl shadow-xl flex items-center gap-2 transition-all duration-300 pointer-events-none ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'
        }`}
      >
        {variant === 'error' ? (
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-secondary-fixed" />
        )}
        <span className="font-display text-label-md">{message}</span>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast phải được dùng bên trong <ToastProvider>');
  }
  return ctx;
}
