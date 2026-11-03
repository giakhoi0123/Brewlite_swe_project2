'use client';

import React, { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Coffee, KeyRound, Lock, LogIn, Mail } from 'lucide-react';
import { useAuth } from '../../components/auth/AuthProvider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || searchParams.get('next') || '/';

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const user = await login(trimmedEmail, password);
      if (user.role === 'BARISTA') {
        router.push(redirectPath.startsWith('/barista') ? redirectPath : '/barista');
      } else {
        router.push(redirectPath);
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
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
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Đăng nhập BrewLite</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Thưởng thức cà phê đậm vị cùng nhiều ưu đãi đặc quyền
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <div>
          <label htmlFor="login-email" className="block text-label-md font-semibold text-on-surface mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@vidu.com"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="text-label-md font-semibold text-on-surface">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-label-sm text-secondary hover:underline transition-colors"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
              <LogIn className="w-5 h-5" />
              <span>ĐĂNG NHẬP</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 text-center">
        <p className="text-body-sm text-on-surface-variant">
          Chưa có tài khoản?{' '}
          <Link
            href={redirectPath !== '/' ? `/register?redirect=${encodeURIComponent(redirectPath)}` : '/register'}
            className="text-secondary font-semibold hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-10 px-4">
      <Suspense fallback={<div className="text-center py-12">Đang tải biểu mẫu...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
