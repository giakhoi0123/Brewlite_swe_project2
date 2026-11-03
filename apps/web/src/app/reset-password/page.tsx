'use client';

import React, { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Coffee, KeyRound, Lock } from 'lucide-react';
import { resetPasswordApi } from '../../services/auth-api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Mã token không hợp lệ hoặc thiếu liên kết đặt lại mật khẩu.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Mật khẩu mới phải chứa ít nhất một chữ hoa.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Mật khẩu mới phải chứa ít nhất một chữ số.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không trùng khớp.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi(token, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Không thể đặt lại mật khẩu. Mã có thể đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-space-md sm:p-space-lg bg-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgba(43,24,16,0.08)] border border-outline-variant/20">
      <div className="text-center mb-space-md">
        <div className="w-12 h-12 rounded-full bg-primary mx-auto flex items-center justify-center text-on-primary mb-3 shadow-md">
          <Coffee className="w-6 h-6" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Đặt lại mật khẩu</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Thiết lập mật khẩu bảo mật mới cho tài khoản của bạn
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

      {success ? (
        <div className="p-space-md rounded-xl bg-secondary-container/30 border border-secondary/30 text-on-surface text-center flex flex-col items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-secondary" />
          <p className="text-body-md font-semibold">Đặt lại mật khẩu thành công!</p>
          <p className="text-body-sm text-on-surface-variant">Đang chuyển hướng về trang đăng nhập trong giây lát...</p>
          <Link
            href="/login"
            className="mt-2 inline-flex items-center gap-1.5 text-secondary font-semibold hover:underline text-body-sm"
          >
            Đến trang đăng nhập ngay
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          <div>
            <label htmlFor="reset-new-password" className="block text-label-md font-semibold text-on-surface mb-1">
              Mật khẩu mới
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input
                id="reset-new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự, 1 hoa, 1 số"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-label-md font-semibold text-on-surface mb-1">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input
                id="reset-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
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
              <span>CẬP NHẬT MẬT KHẨU</span>
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-10 px-4">
      <Suspense fallback={<div className="text-center py-12">Đang tải biểu mẫu...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
