'use client';

import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Coffee, KeyRound, Mail, Send } from 'lucide-react';
import { forgotPasswordApi } from '../../services/auth-api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập email');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordApi(trimmedEmail);
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md mx-auto p-space-md sm:p-space-lg bg-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgba(43,24,16,0.08)] border border-outline-variant/20">
        <div className="text-center mb-space-md">
          <div className="w-12 h-12 rounded-full bg-primary mx-auto flex items-center justify-center text-on-primary mb-3 shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="font-display text-headline-sm font-bold text-on-surface">Quên mật khẩu?</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Nhập email tài khoản của bạn để nhận liên kết đặt lại mật khẩu
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-space-md p-space-sm rounded-xl bg-error-container/40 border border-error/30 text-error text-body-sm flex items-start gap-2"
          >
            <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message ? (
          <div className="p-space-md rounded-xl bg-secondary-container/30 border border-secondary/30 text-on-surface text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-secondary" />
            <p className="text-body-md font-medium">{message}</p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center gap-1.5 text-secondary font-semibold hover:underline text-body-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
            <div>
              <label htmlFor="forgot-email" className="block text-label-md font-semibold text-on-surface mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten@vidu.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-space-md mt-2 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>GỬI YÊU CẦU</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
