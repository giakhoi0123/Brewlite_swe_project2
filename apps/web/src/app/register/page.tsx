'use client';

import React, { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Coffee, KeyRound, Lock, Mail, User, UserPlus } from 'lucide-react';
import { useAuth } from '../../components/auth/AuthProvider';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || searchParams.get('next') || '/';

  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('Họ và tên phải có ít nhất 2 ký tự');
      return;
    }
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có độ dài tối thiểu 8 ký tự');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Mật khẩu phải chứa ít nhất một chữ in hoa');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Mật khẩu phải chứa ít nhất một chữ số');
      return;
    }
    if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp');
      return;
    }

    setLoading(true);
    try {
      await register(trimmedName, trimmedEmail, password);
      router.push(redirectPath);
    } catch (err: any) {
      setError(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-space-md sm:p-space-lg bg-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgba(43,24,16,0.08)] border border-outline-variant/20">
      <div className="text-center mb-space-md">
        <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center text-on-secondary mb-3 shadow-md">
          <Coffee className="w-6 h-6" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Tạo tài khoản BrewLite</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Gia nhập cộng đồng yêu cà phê và nhận ngay ưu đãi
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
          <label htmlFor="reg-fullname" className="block text-label-md font-semibold text-on-surface mb-1">
            Họ và tên
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="reg-fullname"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-label-md font-semibold text-on-surface mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@vidu.com"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-label-md font-semibold text-on-surface mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="reg-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự, 1 hoa, 1 số"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm" className="block text-label-md font-semibold text-on-surface mb-1">
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              id="reg-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-space-md mt-2 rounded-full bg-secondary text-on-secondary font-display text-label-lg font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>ĐĂNG KÝ TÀI KHOẢN</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 text-center">
        <p className="text-body-sm text-on-surface-variant">
          Đã có tài khoản?{' '}
          <Link
            href={redirectPath !== '/' ? `/login?redirect=${encodeURIComponent(redirectPath)}` : '/login'}
            className="text-secondary font-semibold hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-10 px-4">
      <Suspense fallback={<div className="text-center py-12">Đang tải biểu mẫu...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
