'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Clock, Coffee, LogOut, Search, ShoppingBag, User as UserIcon, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useCart } from '../cart/CartProvider';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/thuc-don', label: 'Thực đơn' },
  { href: '/khuyen-mai', label: 'Khuyến mãi' },
  { href: '/lich-su-don-hang', label: 'Lịch sử' },
  { href: '/ve-chung-toi', label: 'Về chúng tôi' },
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { totalQuantity } = useCart();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/thuc-don?q=${encodeURIComponent(q)}` : '/thuc-don');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-md shadow-[0_1px_8px_rgba(43,24,16,0.04)]">
      <div className="h-20 max-w-[1200px] mx-auto px-margin md:px-margin-lg flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xl">
          <Link href="/" className="flex items-center gap-space-sm group">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary transition-transform group-hover:scale-95">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="font-display text-headline-sm text-primary tracking-tight">BrewLite</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-space-xs p-space-xs bg-surface-container rounded-full">
            {NAV_LINKS.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-space-md py-space-xs rounded-full font-display text-label-lg transition-colors ${
                    active
                      ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(43,24,16,0.08)]'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-space-sm">
          <form
            onSubmit={handleSearch}
            role="search"
            className="hidden md:flex items-center bg-surface-container-low rounded-full px-space-md py-space-xs text-on-surface-variant w-56 focus-within:w-64 focus-within:bg-surface-container-lowest transition-all shadow-[0_2px_8px_rgba(43,24,16,0.04)]"
          >
            <Search className="w-[18px] h-[18px] mr-space-xs text-outline" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm cà phê, hạt rang..."
              aria-label="Tìm kiếm trên toàn trang"
              className="bg-transparent w-full text-body-sm text-on-surface focus:outline-none placeholder:text-outline"
            />
          </form>

          <Link
            href="/gio-hang"
            aria-label={`Giỏ hàng (${totalQuantity} món)`}
            className="relative w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shadow-[0_2px_8px_rgba(43,24,16,0.04)]"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalQuantity > 0 && (
              <span className="absolute -top-1 -right-1 bg-secondary text-on-secondary font-display text-label-sm min-w-5 h-5 px-1 rounded-full flex items-center justify-center shadow-sm">
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Tài khoản người dùng"
                className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-display font-bold text-label-md flex items-center justify-center ring-2 ring-surface-container-high shadow-sm hover:scale-105 transition-transform"
              >
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-outline-variant/20">
                    <p className="text-body-sm font-bold text-on-surface truncate">{user.fullName}</p>
                    <p className="text-label-sm text-on-surface-variant truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                      {user.role === 'BARISTA' ? 'Barista' : user.role === 'MANAGER' ? 'Quản lý' : 'Khách hàng'}
                    </span>
                  </div>

                  {user.role === 'BARISTA' && (
                    <Link
                      href="/barista"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-body-sm text-secondary hover:bg-surface-container font-semibold transition-colors"
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      Kênh Barista
                    </Link>
                  )}

                  <Link
                    href="/lich-su-don-hang"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-body-sm text-on-surface hover:bg-surface-container font-medium transition-colors"
                  >
                    <Clock className="w-4 h-4 text-on-surface-variant" />
                    Lịch sử đơn hàng
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-body-sm text-error hover:bg-error-container/20 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              aria-label="Đăng nhập tài khoản"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-on-surface hover:text-primary hover:bg-surface-container-high font-display text-label-md transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng nhập</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};